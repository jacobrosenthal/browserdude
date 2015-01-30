#browserdude
Upload to Arduinos from Chrome.

Currently just a reference implementation of how to webpack [stk500v1](https://www.npmjs.com/package/stk500). Long term we could other programmer support like [Pinoccio's stk500v2](https://github.com/Pinoccio/js-stk500) and whitelist our app so any installed app could utilize our programming functionality to flash an arduino. For now treat as a bootstrap for creating your own Chrome Arduino app.

install
-------
```
npm i && gulp
```
Then go to chrome://extensions/ and check developer mode in the upper right corner. Then load unpacked extension and choose the build directory. If you make any changes to main.js remember to rebuild with gulp and 'reload' the extension in chrome://extensions/

run
---
Launch the app from your Chrome Apps drawer. By default uploads StandardFirmata to the first Uno it can find. With your arduino plugged in, click Program on the window that opens. If you want more debug info, check the console tab of the app page, or the background page (chrome://extensions/ Inspect views: background page)

changelog
---------
0.0.1
first

0.1.0
* move to stk500 1.0.2
* move to new fork of browser-serialport chrome-serialport with near full compatibility with new browser-serialport
* switched to browserifying behind the scenes for fs and serialport

0.1.1
* remove built files and add gulp to create build directory 
* move from browserify to webpack
* go back to mainline browser-serialport package
* swap index.js and main.js names for consistency