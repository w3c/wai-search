(function () {
  // var Site = "https://www.w3.org/";
  // var Site = "http://90.9.146.48/";
  var Site = "http://localhost/";

  var perspectivesRules = `{
  "region": {
    "select": ".video-listing li",
    "follow": {
      "flavors": ["video"],
      "region": {
        "select": "#main",
        "find": [
          // { "select": "meta[name=description]",
          //   "attribute": "content", "quality": 0.8,
          //   "replace": [
          //     ["^Short? +video +about +", ""],
          //     [" - what (is it|are they).*", ""],
          //     [" for web accessibility$", ""] ]
          // },
          {
            "select": "h1 .subhead"
          }, {
            "select": "h1",
            "quality": 1
          }, {
            "select": "h2",
            "quality": 0.9
          }
        ],
        "rest": { "quality": 0.1 }
      }
    }
  }
}`;

  var tutorialsRules = `{
  "region": {
    "select": "ul.topics li",
    // "then": "slice(0,1)",
    "follow": {
      "flavors": ["tutorial"],
      "region": [{
        "select": "ul[aria-labelledby=list-heading-tutorials] li",
        "follow": {
          // "then": "slice(1,2)",
          "find": [
            // remove navigation box
            { "select": "[role=navigation]"},
            { "select": "h2,h3", "quality": 1}
          ],
          "rest": { "quality": 0.3, "flavors": ["tutorial", "example"] }
        }
      }]
    }
  }, "missing": "index"
}`;

  var preliminaryRules = ` {
   "region": {
     "select": ".search-region",
     "next-anchor": "[id]",
     "flavors": ["example"],
     "find": [
       { "select": "h2", "quality": 1 }
     ],
     "rest": {
       "quality": 0.5
     }
   }
 }`;

  var bcaseRules = `{
  "region": {
    "select": "li.listspaced",
    "find": [
      { "select": ">", "attribute": "content", "quality": 1}
    ],
    "follow": {
      "flavors": ["benefit"],
      "region": {
        "select": "#main",
        "find": [
          { "select": "h2 a", "then": "parent()", "quality": 1}
        ],
        "rest": { "quality": 0.2}
      }
    }
  }
}`;

  var TargetList = [
    { path: "WAI/perspectives/", func: parseDirected, sr: perspectivesRules },
    { path: "WAI/tutorials/", func: parseDirected, sr: tutorialsRules },
    { path: "WAI/bcase/", func: parseDirected, sr: bcaseRules },
    { path: "WAI/eval/preliminary.php", func: parseDirected, sr: preliminaryRules },
    // { path: "WAI/eval/p2.php", func: parseDirected },
  ];

  function startCrawl (iface, targetList) {
    targetList.forEach(g => {
      var url = Site+g.path;
      var cb = (iface, jQuery, getAbs, url, index) => {
        parseDirected(iface, jQuery, getAbs, url, index, g.sr);
      };
      iface.get(url, cb);
    });

  }

  function parseDirected (iface, jQuery, getAbs, url, index, searchRules) {
    iface.logElt.find(".index").before(status);
    if (!searchRules && jQuery("#searchRules").length !== 1) {
      index.fail("index rules", "expected exaclty one <script id=\"searchRules\"></script> in the source");
      return;
    }
    var configRoot;
    try {
      configRoot = JSON.parse(searchRules || jQuery("#searchRules").text());
    } catch (e) {
      index.fail(e.toString())
      return;
    }

    parseDirectives(iface, {
      find: function () {
        return jQuery.apply(jQuery, [].slice.call(arguments));
      }
    }, getAbs, url, index, configRoot, [], undefined);
  }

  function parseDirectives (iface, elts, getAbs, url, index, config, flavors, missing) {
    try {
      if ("flavors" in config)
        flavors = config.flavors;
      if ("missing" in config)
        missing = config.missing;
      if ("region" in config) {
        if (config.region.constructor === Array)
          config.region.forEach(region => {
            processRegion(elts, region);
          })
        else
          processRegion(elts, config.region);
      }
      var indexMe = {};
      if ("find" in config) {
        var found = config.find.reduce((acc, find) => {
          return acc.add(parseThenElse(elts.find(find.select), find));
        }, $("create empty selection"));
      }
      if ("rest" in config) {
        return parseThenElse(elts.find(">"), config.rest);
      }

      function processRegion (elts, config) {
        if (!("select" in config))
          return iface.log("expected select in "+JSON.stringify(config));
        var sections = elts.find(config.select);
        if ("then" in config) {
          eval(`sections = sections.${config.then};`);
        }
        if ("follow" in config) {
          var az = sections.map((_, section) => {
            return $(section).find("a");
          });
          if ("then" in config.follow) {
            eval(`az = az.${config.follow.then};`);
          }
          iface.log("scraping", az.length, "pages:");
          az.each((idx, a) => {
            var href = getAbs($(a).attr("href"));
            iface.get(
              href,
              function (iface2, jQuery2, getAbs2, url2, index2) {
                parseDirectives(iface2, {
                  find: function () {
                    return jQuery2.apply(jQuery2, [].slice.call(arguments));
                  }
                }, getAbs2, url2, index2, config.follow, flavors, missing);
              });
          });
        } else if ("next-anchor" in config) {
          sections.each((_, section) => {
            var closest = url + "#" + $(section).
                find(config["next-anchor"]).slice(0, 1).attr("id");
            parseDirectives(iface, $(section), getAbs, closest, index, config, flavors, missing);
            });
        } else {
          sections.each((_, section) => {
            parseDirectives(iface, $(section), getAbs, url, index, config, flavors, missing);
          });
        // } else {
        //   return index.fail("expected next-anchor or follow in", JSON.stringify(config, null, 2));
        }
        return;
      }

      function parseThenElse (innerElts, config) {
        if ("then" in config) {
          eval(`innerElts = innerElts.${config.then};`);
        }
        if ("quality" in config) {
          var vals = innerElts.map((idx, elt) => {
            return "attribute" in config ?
              $(elt).attr(config.attribute) :
              $(elt).text();
          }).get().filter(val => {
            return val ? true : false;
          });
          // vals will be [] if there were no matches.
          if (vals.length) {
            if ("replace" in config) {
              vals = vals.map(val => {
                return config.replace.reduce((acc, pair) => {
                  var regexp = new RegExp(pair[0], pair[2] || "");
                  return acc.replace(regexp, pair[1]);
                }, val);
              });
            }
            vals = vals.map(val => {
              return val.replace(/(\s+)/g, t => {
                return t[0];
              }).toLowerCase();
            });
            index.set4(url, config.flavors || flavors, config.quality, vals);
          } else if (missing) {
            addTruncate($);
            // console.log($.truncate(elts.find(">"), { length: 50 }));
            var notIn =
                (innerElts.length ? innerElts : elts.find(">")).map((i, el) => {
                  return $.truncate($(el), { length: 50 });
                }).get().join("\n");
            var what = innerElts.length ? "indexable content" : "select " + config.select;
            switch (missing) {
            case "debugger":
              console.log(what + " not found in " + notIn);
              debugger;
              break;
            case "log":
              iface.log(what + " not found in " + notIn);
              break;
            case "index":
              index.fail(what + " not found in ", notIn);
              break;
            default:
              index.fail("unknown missing directive", config.missing);
            }
          }
        }
        innerElts.remove(); // Remove stuff we've already indexed.
        return innerElts;
      }
    } catch (e) {
      return index.fail("error", e.toString());
    }
  }

  // Handy array equivalence function for debuggin and testing.
  function aeq (l, r) {
    return l.length === r.length &&
      l.reduce((acc, elt, i) => {
        return acc && l[i] === r[i];
      }, true);
  }

  function makeQueue (done) {
    var todo = 0;
    return {
      add: function (url) {
        ++todo;
      },
      finished: function (url) {
        if (--todo === 0)
          done();
      }
    };
  }

  // https://github.com/pathable/truncate
  function addTruncate ($) {

    // Matches trailing non-space characters.
    var chop = /(\s*\S+|\s)$/;

    // Matches the first word in the string.
    var start = /^(\S*)/;

    // Return a truncated html string.  Delegates to $.fn.truncate.
    $.truncate = function(html, options) {
      return $('<div></div>').append(html).truncate(options).html();
    };

    // Truncate the contents of an element in place.
    $.fn.truncate = function(options) {
      if ($.isNumeric(options)) options = {length: options};
      var o = $.extend({}, $.truncate.defaults, options);

      return this.each(function() {
        var self = $(this);

        if (o.noBreaks) self.find('br').replaceWith(' ');

        var text = self.text();
        var excess = text.length - o.length;

        if (o.stripTags) self.text(text);

        // Chop off any partial words if appropriate.
        if (o.words && excess > 0) {
          var truncated = text.slice(0, o.length).replace(chop, '').length;

          if (o.keepFirstWord && truncated === 0) {
            excess = text.length - start.exec(text)[0].length - 1;
          } else {
            excess = text.length - truncated - 1;
          }
        }

        if (excess < 0 || !excess && !o.truncated) return;

        // Iterate over each child node in reverse, removing excess text.
        $.each(self.contents().get().reverse(), function(i, el) {
          var $el = $(el);
          var text = $el.text();
          var length = text.length;

          // If the text is longer than the excess, remove the node and continue.
          if (length <= excess) {
            o.truncated = true;
            excess -= length;
            $el.remove();
            return;
          }

          // Remove the excess text and append the ellipsis.
          if (el.nodeType === 3) {
            // should we finish the block anyway?
            if (o.finishBlock) {
              $(el.splitText(length)).replaceWith(o.ellipsis);
            } else {
              $(el.splitText(length - excess - 1)).replaceWith(o.ellipsis);
            }
            return false;
          }

          // Recursively truncate child nodes.
          $el.truncate($.extend(o, {length: length - excess}));
          return false;
        });
      });
    };

    $.truncate.defaults = {

      // Strip all html elements, leaving only plain text.
      stripTags: false,

      // Only truncate at word boundaries.
      words: false,

      // When 'words' is active, keeps the first word in the string
      // even if it's longer than a target length.
      keepFirstWord: false,

      // Replace instances of <br> with a single space.
      noBreaks: false,

      // if true always truncate the content at the end of the block.
      finishBlock: false,

      // The maximum length of the truncated html.
      length: Infinity,

      // The character to use as the ellipsis.  The word joiner (U+2060) can be
      // used to prevent a hanging ellipsis, but displays incorrectly in Chrome
      // on Windows 7.
      // http://code.google.com/p/chromium/issues/detail?id=68323
      ellipsis: '\u2026' // '\u2060\u2026'

    };

  }


  var exportMe = {
    targetList: TargetList,
    makeQueue: makeQueue,
    startCrawl: startCrawl
  };
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
    module.exports = exportMe;
  else
    window.Scrounger = exportMe;
})();

