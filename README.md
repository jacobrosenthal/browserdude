##browserdude
Upload to Arduinos from Chrome.

Currently just a reference implementation of how to browserify [stk500v1](https://www.npmjs.com/package/stk500). Long term we could other programmer support like [Pinoccio's stk500v2](https://github.com/Pinoccio/js-stk500) and whitelist our app so any installed app could utilize our programming functionality to flash an arduino. For now treat as a bootstrap for creating your own Chrome Arduino app.

Currently using [my fork](https://www.npmjs.com/package/chrome-serialport) of [@garrows browser-serialport](https://www.npmjs.com/package/browser-serialport) as it more closely matches [serialport](https://www.npmjs.com/package/serialport).

##INSTALL
Go to chrome://extensions/ and check developer mode in the upper right corner. Then load unpacked extension and choose this directory.

##RUN
By default uploads StandardFirmata to the first Uno it can find. Launch the app from your Chrome Apps drawer. With your arduino plugged in, click Program on the window that opens. If you want more debug info, right click and inspect element and open the console tab.
You can also test in node with:
```
npm i serialport
node index.js /dev/tty.something
```

##Make Changes:
If you make any changes to index.js you'll need to rebuild. Assuming you have node already installed, download and install dependancies with:
```
npm install
```
Then
```
npm run build
```
And now you can Reload the extension at chrome://extensions/

###CHANGELOG
0.0.1
first

0.1.0
* move to stk500 1.0.2
* move to new fork of browser-serialport chrome-serialport with near full compatibility with new browser-serialport
* switched to browserifying behind the scenes for fs and serialport