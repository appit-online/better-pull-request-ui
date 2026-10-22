const { app, BrowserWindow, ipcMain } = require('electron')
const remote = require('electron');
const { Octokit } = require("@octokit/core");
const path = require('path')
const url = require('url')
const https = require('https');
const http = require('http');
let win;
const storage = require('electron-json-storage');
const CONFIG_SETTINGS_NAME = 'settings';

let octokit;

function gitlabRequest(baseUrl, apiPath, token) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(apiPath, baseUrl.replace(/\/$/, '') + '/');
    const lib = fullUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: fullUrl.hostname,
      port: fullUrl.port || (fullUrl.protocol === 'https:' ? 443 : 80),
      path: fullUrl.pathname + fullUrl.search,
      method: 'GET',
      headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON response: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function gitlabPost(baseUrl, apiPath, token) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(apiPath, baseUrl.replace(/\/$/, '') + '/');
    const lib = fullUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: fullUrl.hostname,
      port: fullUrl.port || (fullUrl.protocol === 'https:' ? 443 : 80),
      path: fullUrl.pathname + fullUrl.search,
      method: 'POST',
      headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json', 'Content-Length': 0 },
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error('Invalid JSON response: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function checkAndRotateToken(config) {
  try {
    const tokenInfo = await gitlabRequest(config.hostname, '/api/v4/personal_access_tokens/self', config.apiToken);

    if (!tokenInfo || tokenInfo.message) {
      return { action: 'expired' };
    }

    if (!tokenInfo.expires_at) {
      return { action: 'none' };
    }

    const expiresAt = new Date(tokenInfo.expires_at);
    const now = new Date();
    const daysLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { action: 'expired' };
    }

    const bufferDays = config.rotateBufferDays != null ? config.rotateBufferDays : 2;
    if (daysLeft <= bufferDays) {
      const result = await gitlabPost(config.hostname, `/api/v4/personal_access_tokens/${tokenInfo.id}/rotate`, config.apiToken);
      if (result.statusCode !== 200 && result.statusCode !== 201) {
        return { action: 'expired' };
      }
      return { action: 'rotated', newToken: result.body.token, expiresAt: result.body.expires_at };
    }

    return { action: 'none', expiresAt: tokenInfo.expires_at, daysLeft };
  } catch (e) {
    console.log('Token check error:', e);
    return { action: 'none' };
  }
}

async function createWindow () {
    win = new BrowserWindow({
        width: 1200,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
          enableRemoteModule: true,
        },
      enableRemoteModule:true,
    })

    win.loadURL(url.format({
      pathname: path.join(__dirname, 'pullRequest/index.html'),
      protocol: 'file:',
      slashes: true
    }))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

/*
  Actions from UI
 */
ipcMain.on("openUrl", (event, path) => {
  remote.shell.openExternal(path);
});

ipcMain.on("getPullRequests", async (event) => {

  // Read config
  storage.get(CONFIG_SETTINGS_NAME, async function(error, config) {
    if (error) {
      console.log(error);
      win.webContents.send("pullRequests", null);
    } else {
      if (config && config.hostname && config.apiToken) {

        if (config.provider === 'gitlab') {

          // Auto-rotate token if enabled
          if (config.autoRotateToken) {
            const rotationResult = await checkAndRotateToken(config);
            if (rotationResult.action === 'expired') {
              win.webContents.send('tokenExpired', {});
              win.webContents.send('pullRequests', null);
              return;
            }
            if (rotationResult.action === 'rotated') {
              config.apiToken = rotationResult.newToken;
              storage.set(CONFIG_SETTINGS_NAME, Object.assign({}, config), (err) => {
                if (err) console.log('Failed to save rotated token:', err);
              });
              win.webContents.send('tokenRotated', { newToken: rotationResult.newToken, expiresAt: rotationResult.expiresAt });
            }
          }

          // GitLab REST API
          try {
            const user = await gitlabRequest(config.hostname, '/api/v4/user', config.apiToken);

            let mrsUrl;
            if (config.orgName) {
              mrsUrl = `/api/v4/groups/${encodeURIComponent(config.orgName)}/merge_requests?reviewer_id=${user.id}&state=opened&scope=all&with_head_pipeline=true`;
            } else {
              mrsUrl = `/api/v4/merge_requests?reviewer_id=${user.id}&state=opened&scope=all&with_head_pipeline=true`;
            }
            const mrs = await gitlabRequest(config.hostname, mrsUrl, config.apiToken);

            if (!Array.isArray(mrs)) {
              console.log('GitLab API error:', mrs);
              win.webContents.send('pullRequests', mrs);
              return;
            }

            const edges = mrs.map((mr) => {
              const projectPath = mr.references && mr.references.full
                ? mr.references.full.split('!')[0]
                : String(mr.project_id);
              const projectName = projectPath.split('/').pop();
              const pipelineStatus = mr.head_pipeline && mr.head_pipeline.status
                ? mr.head_pipeline.status.toUpperCase()
                : null;
              return {
                node: {
                  url: mr.web_url,
                  title: mr.title,
                  number: mr.iid,
                  createdAt: mr.created_at,
                  repository: { name: projectName, isPrivate: true },
                  author: { login: mr.author.username, name: mr.author.name, avatarUrl: mr.author.avatar_url },
                  commits: { nodes: [{ commit: { status: { state: pipelineStatus, contexts: [] } } }] },
                },
              };
            });

            win.webContents.send('pullRequests', { search: { edges } });
          } catch (e) {
            console.log(e);
            win.webContents.send('pullRequests', e);
          }

        } else {
          // GitHub GraphQL API (default)
          octokit = new Octokit({
            auth: config.apiToken,
            baseUrl: config.hostname,
          });

          try {
            const userData = await octokit.request("/user");

            let orgSearch = ""
            if (config.orgName) {
              orgSearch = "org:" + config.orgName
            }

            let query = `{
      search(query: "` + orgSearch + ` is:pr is:open review-requested:` + userData.data.login + ` created:>2020-04-01", type: ISSUE, last: 100) {
        edges {
          node {
            ... on PullRequest {
              url
              title
              number
              createdAt
              repository {
                name
                isPrivate
              }
              author {
                avatarUrl
                login
                name
              }
              commits(last: 1) {
                nodes {
                  commit {
                    status {
                      state
                      contexts {
                        state
                        targetUrl
                        description
                        context
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;
            const result = await octokit.graphql(query);
            win.webContents.send("pullRequests", result);
          } catch (e) {
            console.log(e);
            win.webContents.send("pullRequests", e);
          }
        }

      } else {
        win.webContents.send("pullRequests", null);
      }
    }
  });

});

ipcMain.on("getTokenInfo", async () => {
  storage.get(CONFIG_SETTINGS_NAME, async function(error, config) {
    if (error || !config || config.provider !== 'gitlab' || !config.apiToken) {
      win.webContents.send('tokenInfo', null);
      return;
    }
    try {
      const tokenInfo = await gitlabRequest(config.hostname, '/api/v4/personal_access_tokens/self', config.apiToken);
      if (!tokenInfo || tokenInfo.message) {
        win.webContents.send('tokenInfo', null);
        return;
      }
      const expiresAt = tokenInfo.expires_at || null;
      let daysLeft = null;
      if (expiresAt) {
        daysLeft = Math.floor((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
      }
      win.webContents.send('tokenInfo', { expiresAt, daysLeft, id: tokenInfo.id });
    } catch (e) {
      console.log(e);
      win.webContents.send('tokenInfo', null);
    }
  });
});

ipcMain.on("getUser", async (event, path) => {
  storage.get(CONFIG_SETTINGS_NAME, async function(error, config) {
    if (error) {
      console.log(error);
      win.webContents.send("userData", false);
    } else {
      if (config && config.hostname && config.apiToken) {
        try {
          if (config.provider === 'gitlab') {
            const user = await gitlabRequest(config.hostname, '/api/v4/user', config.apiToken);
            win.webContents.send("userData", { data: { login: user.username, avatar_url: user.avatar_url, name: user.name } });
          } else {
            octokit = new Octokit({ auth: config.apiToken, baseUrl: config.hostname });
            const userData = await octokit.request("/user");
            win.webContents.send("userData", userData);
          }
        } catch (e) {
          console.log(e);
          win.webContents.send("userData", false);
        }
      }
    }
  });
});

ipcMain.on("updateSettings", async (event, data) => {
  storage.set(CONFIG_SETTINGS_NAME, data, function(error) {
    if (error) {
      console.log(error);
      win.webContents.send("updatedSettings", false);
    }else{
      win.webContents.send("updatedSettings", true);
    }
  });
});

ipcMain.on("getSettings", async () => {
  storage.get(CONFIG_SETTINGS_NAME, function(error, settings) {
    if (error) {
      console.log(error);
      win.webContents.send("receivedSettings", false);
    }else{
      win.webContents.send("receivedSettings", settings);
    }
  });
});
