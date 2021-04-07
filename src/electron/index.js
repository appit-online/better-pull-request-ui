const { app, BrowserWindow, ipcMain } = require('electron')
const remote = require('electron');
const { Octokit } = require("@octokit/core");
const path = require('path')
const url = require('url')
let win;
const storage = require('electron-json-storage');
const CONFIG_SETTINGS_NAME = 'settings';

let octokit;

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
    }else{
      if(config && config.hostname && config.apiToken){

        octokit = new Octokit({
          auth: config.apiToken,
          baseUrl: config.hostname,
        });


        try{
          const userData  = await octokit.request("/user");

          let orgSearch = ""
          if(config.orgName){
            orgSearch = "org:" + config.orgName
          }

          let query = `{
      search(query: "`+ orgSearch +` is:pr is:open review-requested:` + userData.data.login + ` created:>2020-04-01", type: ISSUE, last: 100) {
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
        }catch (e){
          console.log(e);
          win.webContents.send("pullRequests", e);
        }

      }else{
        win.webContents.send("pullRequests", null);
      }
    }
  });


});

ipcMain.on("getUser", async (event, path) => {
  // Read config
  storage.get(CONFIG_SETTINGS_NAME, async function(error, config) {
    if (error) {
      console.log(error);
      win.webContents.send("userData", false);
    }else {
      if (config && config.hostname && config.apiToken && config.orgName) {

        octokit = new Octokit({
          auth: config.apiToken,
          baseUrl: config.hostname,
        });
        try {
          const userData = await octokit.request("/user");
          win.webContents.send("userData", userData);
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
