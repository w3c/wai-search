#!/usr/bin/env node

(function(iface) {

  var scrounge = require('./scroungelib');
  scrounge.index(iface)
})(getInterface());

function getInterface () {
  var jqURL = "http://localhost/2017/04/wai-search/jquery/jquery-1.12.4.js"
  // var jqURL = "http://code.jquery.com/jquery.js";
  var _resourceText = {  };
  var _log = console.log;
  var _queue = require('./scroungelib').makeQueue(() => {
    _log(JSON.stringify(_resourceText));
  })

  return {
    resourceText: _resourceText,
    log: _log,
    get: function (url, f) {
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
          f(err, window.$, getAbs, url, _resourceText);
          _queue.finished(url);
        });
    }
  };
}

