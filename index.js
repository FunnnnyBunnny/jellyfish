const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require("fs")
const path = require("path")
const homedir = require('os').homedir();
const child_process = require('child_process')
const fetch = require("node-fetch")

const CALAMARI_API_LOCATION = "/Users/Shared/Calamari"
const DEFAULT_CAPPS_LOCATION = path.join(homedir,"Documents","CalamariApps")
const JELLYFISH_DATA_DIR = path.join(homedir,"Documents","Jellyfish")



function createWindow () {
    
    if (!fs.existsSync(path.join(DEFAULT_CAPPS_LOCATION,"CalamariHookHelperTool"))) {
        var installCalamari = dialog.showMessageBoxSync({
            type: "error",
            buttons: ["No","Yes"],
            defaultId: 1,
            message: "Calamari not installed",
            detail: "Calamari-M is not installed, would you like to install it now?",
        })
        if (installCalamari == 1) {
            child_process.execSync(`mkdir "${DEFAULT_CAPPS_LOCATION}";cd ${DEFAULT_CAPPS_LOCATION};curl https://cdn.calamari.cc/C-M.zip > C-M.zip; curl https://cdn.calamari.cc/Dependencies.zip > deps.zip; unzip C-M.zip;unzip deps.zip;rm -rf C-M.zip deps.zip __MACOSX;`)
            return createWindow()
        } else {
            return process.exit()
        }
    }
    if (dialog.showMessageBoxSync({
        buttons: ["No","Yes"],
        defaultId: 1,
        message: "PLEASE READ",
        detail: "Jellyfish is only to be used on games that you have explicit permission to run a LSI on.\n\nAre you intending to use Jellyfish to inject into games you are not the owner of, or do not have permission from the owner to run a LSI on?",
    }) == 1) {
        return process.exit()
    }
    if (!fs.existsSync(CALAMARI_API_LOCATION)) {
        fs.mkdirSync(CALAMARI_API_LOCATION)
    }
    
    
    // Create the browser window.
    const win = new BrowserWindow({
        width: 768,
        height: 585,
        show:false,
        webPreferences: {
            nodeIntegration: true
        }
    })
    async function needsToLogin() {
        try {
            var username = fs.readFileSync(path.join(CALAMARI_API_LOCATION,"GY"))
            var password = fs.readFileSync(path.join(CALAMARI_API_LOCATION,"NGV"))
            var ftch = await fetch("https://auth.calamari.cc/Login/?type=macosSecure&username=" + username + "&password=" + password + "&t=1347629098027067781", {headers: {"User-Agent":"Jellyfish/1.0 (contact: theLMGN#4444)"}})
            var t = await ftch.text()
            if (t.startsWith("ERROR-")) {
                return t.replace("ERROR-","")
            } else { return false}
        } catch(e) {
            console.error(e)
            return true
        }
    }
    var tmin = 0
    ipcMain.on('set-topmost', (event,arg) => {
        win.setAlwaysOnTop(arg, "floating");
        win.setVisibleOnAllWorkspaces(arg);
        win.setFullScreenable(!arg);
    })
    ipcMain.on('run-script', async (event, arg) => {
        fs.writeFileSync(path.join(CALAMARI_API_LOCATION,"input.txt"),"0" + arg)
    })
    ipcMain.on('inject-button-click', async (event, arg) => {
        event.reply("set-inject-btn-text","Logging in")
        var n2l = await needsToLogin()
        if (n2l) {
            event.reply("set-inject-btn-text",n2l == true ? "Not logged in" : n2l)
            dialog.showMessageBoxSync({
                message: n2l == true ? "Not logged in" : n2l,
                detail: "Calamari credentials are either not present or invalid.\n\nTODO: Create a login screen for Jellyfish, in the mean time, login with the official Calamari-M UI.",
            })
            setTimeout(function() {
                event.reply("enable-inject-btn")
            },2000)
            return false
        }
        event.reply("set-inject-btn-text","Updating")
        // i should be using nodefetch for this, but i am lazy so i'm curling it
        // blocks main thread, but that shouldn't be an issue?
        child_process.execSync('curl -s https://cdn.calamari.cc/libChomp.dylib > "' + path.join(DEFAULT_CAPPS_LOCATION,"libChomp.dylib") + '"')
        event.reply("set-inject-btn-text","Injecting")
        fs.writeFileSync(path.join(CALAMARI_API_LOCATION,"input.txt"),`0local function callback(text)
        game:shutdown()
        end
        local bindableFunction = Instance.new("BindableFunction")
        bindableFunction.OnInvoke = callback
        
        game.StarterGui:SetCore("SendNotification", {
            Title = "Jellyfish for Calamari-M";
            Text = "Calamari has been successfully injected"; 
            Callback = bindableFunction;
            Button1 = "Exit";
        })`)
        require("sudo-prompt").exec(path.join(DEFAULT_CAPPS_LOCATION,"CalamariHookHelperTool"), {name: "Calamari"}, function(e,stdout,stderr) {
            if (e) {
                dialog.showMessageBoxSync({
                    message: "Error while requesting super-user permissions",
                    detail: e.toString(),
                })
                setTimeout(function() {
                    event.reply("enable-inject-btn")
                },2000)
                return event.reply("set-inject-btn-text","Failed")
            }
            if (stdout.includes("invalid pid")) { 
                dialog.showMessageBoxSync({
                    message: "Roblox isn't running",
                    detail: "We couldn't inject into Roblox, well, because there's no Roblox to inject into!",
                })
                setTimeout(function() {
                    event.reply("enable-inject-btn")
                },2000)
                return event.reply("set-inject-btn-text","Failed")
            }
            if (stdout.includes("status: success")) {
                setTimeout(function() {
                    event.reply("enable-inject-btn")
                },2000)
                return event.reply("set-inject-btn-text","Injected")
            }
            dialog.showMessageBoxSync({
                message: "Error occured while injecting",
                detail: stdout,
            })
            setTimeout(function() {
                event.reply("enable-inject-btn")
            },2000)
            return event.reply("set-inject-btn-text","Failed")
            
        })
    })
    var lastUpdate = 0
    function watch() {
        fs.watch(path.join(CALAMARI_API_LOCATION,"input.txt")).on("change",() => {
            console.log(process.uptime() - lastUpdate)
            if (process.uptime() - lastUpdate > 0.01) {
                console.log("noooo! you cant just have an icon spin as confirmation")
                win.webContents.send("script-ran")
                watch()
            }
            lastUpdate = process.uptime()
        })
    }
    watch()
    if (!fs.existsSync(JELLYFISH_DATA_DIR)) {
        fs.mkdirSync(JELLYFISH_DATA_DIR)
    }
    if (!fs.existsSync(path.join(JELLYFISH_DATA_DIR,"Scripts"))) {
        fs.mkdirSync(path.join(JELLYFISH_DATA_DIR,"Scripts"))
    }
    if (!fs.existsSync(path.join(JELLYFISH_DATA_DIR,"Config"))) {
        fs.mkdirSync(path.join(JELLYFISH_DATA_DIR,"Config"))
    }
    
    
    // and load the index.html of the app.
    win.loadFile('www/index.html')
    win.webContents.on('new-window', function(event, url){
        event.preventDefault();
        child_process.spawn("open", [url])
    });
    
    win.once('ready-to-show', () => {
        setTimeout(function() {
            win.show()
        },300)
    })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
    app.quit()
})
