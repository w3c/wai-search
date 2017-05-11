#!/usr/bin/env node

(function(iface) {

  var scrounge = require('./scroungelib');
  scrounge.startCrawl(iface)
})(getInterface());

function getInterface () {
  var jqURL = "http://localhost/2017/04/wai-search/jquery/jquery-1.12.4.js"
  // var jqURL = "http://code.jquery.com/jquery.js";
  var _resourceText = (function () {
      var vals = {  };
      return {
        set: function (key, value) {
          vals[key] = value;
        },
        get: function () {
          return vals;
        }
      };
    })();
  var _log = console.log;
  var _queue = require('./scroungelib').makeQueue(() => {
    _log(JSON.stringify(_resourceText.get()));
  })

  return {
    log: _log,
    get: function (url, f) {
      var _this = this;
      _queue.add(url);
      return require("jsdom").env(
        url,
        [jqURL],
        function (err, window) {
          var a = window.document.createElement('a');
          function getAbs (rel) {
            a.href = rel;
            return a.href;
          }
          f(_this, window.$, getAbs, url, _resourceText);
          _queue.finished(url);
        });
    }
  };
}

