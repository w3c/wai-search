(function () {
  // var Site = "https://www.w3.org/";
  // var Site = "http://90.9.146.48/";
  var Site = "http://localhost/";

  var perspectivesRules = `{
  "region": {
    "select": ".video-listing li",
    "follow": "a",
    "flavors": ["all", "video"],
    "find": [
      { "select": "meta[name=description]", "attribute": "content", "quality": 1, "replace": [
        ["^Short? +video +about +", ""],
        [" - what (is it|are they).*", ""],
        [" for web accessibility$", ""]
      ]}
    ]
  }
}`;

  var tutorialsRules = `{
  "region": {
    "select": "ul.topics li",
    "follow": "a",
    "flavors": ["all", "tutorial"],
    "region": {
      "select": "ul[aria-labelledby=list-heading-tutorials] li",
      "follow": "a",
      "find": [
        { "select": "h2", "quality": 1}
      ]
    }
  }, "missing": "index"
}`;

  var preliminaryRules = ` {
   "region": {
     "select": ".search-region",
     "next-anchor": "[id]",
     "flavors": ["all", "example"],
     "find": [
       { "select": "h2", "quality": 1 }
     ],
     "rest": {
       "quality": 0.5
     }
   }
 }
  `;
  var TargetList = [
      // { path: "WAI/perspectives/", func: parsePerspectives },
      { path: "WAI/perspectives/", func: parseDirected, sr: SearchRules },
      { path: "WAI/tutorials/", func: parseTutorials },
      { path: "WAI/bcase/", func: parseBCase },
      { path: "WAI/eval/preliminary.php", func: parseDirected },
      // { path: "WAI/eval/p2.php", func: parseDirected },
    ]

  function startCrawl (iface, targetList) {
    targetList.forEach(g => {
      var url = Site+g.path;
      var cb = (iface, jQuery, getAbs, url, index) => {
        g.func(iface, jQuery, getAbs, url, index, g.sr);
      };
      iface.get(url, cb);
    });

  }

  /** 
   * page parsers
   */
  function parsePerspectives (iface, jQuery, getAbs, url, index) {
    var videoPages = jQuery(".video-listing li");
    iface.log("scraping", videoPages.length, "video pages:");
    videoPages.each((idx, li) => {
      var perspectiveName = jQuery(li).find("a").attr("href");
      var perspectivePageUrl = getAbs(perspectiveName);

      iface.get(
        perspectivePageUrl,
        function (iface, jQuery, getAbs, url, index) {
          var desc = jQuery("meta[name=description]").attr("content").
              replace(/^Short? +video +about +/, "").
              replace(/ - what (is it|are they).*/, "").
              replace(/ for web accessibility$/, "");
          index.set(perspectivePageUrl, {
            1: desc
          });
        }
      );
    });
  }
  function parseTutorials (iface, jQuery, getAbs, url, index) {
    var videoPages = jQuery("ul.topics li");
    iface.log("scraping", videoPages.length, "video pages:");
    videoPages.each((idx, li) => {
      var relativeName = jQuery(li).find("a").attr("href");
      var pageURL = getAbs(relativeName);
      iface.get(
        pageURL,
        function (iface, jQuery, getAbs, url, index) {
          var subPages = jQuery("ul[aria-labelledby=list-heading-tutorials] li")
          //              .filter((_, elt) => { return $(elt).find("a").length > 0; })
          ;
          iface.log(subPages.length, "sub-pages"); // , subPages.find("a").attr("href").get().join(",")
          subPages.each((idx, li) => {
            var tutorialName = jQuery(li).find("a").attr("href");
            var tutorialPageUrl = getAbs(tutorialName);

            iface.get(
              tutorialPageUrl,
              function (iface, jQuery, getAbs, url, index) {
                var headings = jQuery("h2");
                // iface.log(tutorialPageUrl, headings.length);
                var desc = headings.map((idx, h) => {
                  return jQuery(h).text();
                }).get();
                index.set(tutorialPageUrl, { 1: desc });
              }
            );
          });
        }
      );
    });
  }
  function parseBCase (iface, jQuery, getAbs, url, index) {
    var videoPages = jQuery("li.listspaced");
    index.set(url, {
      1: videoPages.text()
    });
    iface.log("scraping", videoPages.length, "bcase pages:");
    videoPages.each((idx, li) => {
      var bCaseName = jQuery(li).find("a").attr("href");
      var bCasePageUrl = getAbs(bCaseName);

      iface.get(
        bCasePageUrl,
        function (iface, jQuery, getAbs, url, index) {
          var sections = jQuery("h2 a").parent();
          var theRest = sections.nextAll().not(sections);
          index.set(bCasePageUrl, {
            0: sections.map((i, e) => {
              return jQuery(e).text();
            }).get(),
            1: theRest.map((i, e) => {
              return jQuery(e).text();
            }).get()
          });
        }
      );
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
    }, getAbs, url, index, configRoot, ["all"], undefined);
  }

  function parseDirectives (iface, elts, getAbs, url, index, config, flavors, missing) {
      try {
        if ("flavors" in config)
          flavors = config.flavors;
        if ("missing" in config)
          missing = config.missing;
        if ("region" in config) {
          if (!("select" in config.region))
            return iface.log("expected select in "+JSON.stringify(config.region));
          var sections = elts.find(config.region.select);
          if ("next-anchor" in config.region) {
            sections.each((_, section) => {
              var closest = url + "#" + $(section).
                  find(config.region["next-anchor"]).slice(0, 1).attr("id");
              parseDirectives(iface, $(section), getAbs, closest, index, config.region, flavors, missing);
            });
          } else if ("follow" in config.region) {
            var az = sections.map((_, section) => {
              return $(section).find(config.region.follow);
            });
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
                  }, getAbs2, url2, index2, config.region, flavors, missing);
                });
            });
          } else {
            return index.fail("expected next-anchor or follow in", JSON.stringify(config.region, null, 2));
          }
          return;
        }
        var indexMe = {};
        var found = config.find.reduce((acc, find) => {
          innerElts = elts.find(find.select);
          var addMe = {};
          var val = "attribute" in find ?
              innerElts.attr(find.attribute) :
              addMe[find.quality] = [innerElts.text()];
          if (val) {
            if ("replace" in find) {
              val = find.replace.reduce((acc, pair) => {
                var regexp = new RegExp(pair[0], pair[2] || "");
                return acc.replace(regexp, pair[1]);
              }, val);
            }
            addMe[find.quality] = val;
            index.set(url, addMe);
          } else if (missing) {

// https://github.com/pathable/truncate
(function($) {

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

})($);
            // console.log($.truncate(elts.find(">"), { length: 50 }));
            var notIn = 
                (innerElts.length ? innerElts : elts.find(">")).map((i, el) => {
                  return $.truncate($(el), { length: 50 });
                }).get().join("\n");
            var what = innerElts.length ? "indexable content" : "select " + find.select;
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
              index.fail("unknown missing directive", find.missing);
            }
          }
          return acc.add(innerElts);
        }, $("create empty selection"));
        found.remove();
        if ("rest" in config) {
          var addMe = {};
          addMe[config.rest.quality] = elts.children().map((i, e) => {
            return jQuery(e).text();
          }).get();
          index.set(url, addMe);
        }
      } catch (e) {
        return index.fail("error", e.toString());
      }
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

