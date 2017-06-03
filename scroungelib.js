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
    "find": [
      { "select": "meta[name=description]", "attribute": "content", "quality": 1, "replace": [
        ["^Short? +video +about +", ""],
        [" - what (is it|are they).*", ""],
        [" for web accessibility$", ""]
      ]}
    ]
  }
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
    parseDirectives({
      find: function () {
        return jQuery.apply(jQuery, [].slice.call(arguments));
      }
    }, configRoot, url, ["all"], index);

    function parseDirectives (elts, config, href, flavors, index) {
      try {
        if ("flavors" in config)
          flavors = config.flavors;
        if ("region" in config) {
          if (!("select" in config.region))
            return iface.log("expected select in "+JSON.stringify(config.region));
          var sections = elts.find(config.region.select);
          if ("next-anchor" in config.region) {
            sections.each((_, section) => {
              var closest = url + "#" + $(section).
                  find(config.region["next-anchor"]).slice(0, 1).attr("id");
              parseDirectives($(section), config.region, closest, flavors, index);
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
                function (iface, jQuery, getAbs, url, index) {
                  parseDirectives({
                    find: function () {
                      return jQuery.apply(jQuery, [].slice.call(arguments));
                    }
                  }, config.region, url, flavors, index);
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
          if ("replace" in find) {
            val = find.replace.reduce((acc, pair) => {
              var regexp = new RegExp(pair[0], pair[2] || "");
              return acc.replace(regexp, pair[1]);
            }, val);
          }
          addMe[find.quality] = val;
          index.set(href, addMe);
          return acc.add(innerElts);
        }, $("create empty selection"));
        found.remove();
        if ("rest" in config) {
          var addMe = {};
          addMe[config.rest.quality] = elts.children().map((i, e) => {
            return jQuery(e).text();
          }).get();
          index.set(href, addMe);
        }
      } catch (e) {
        return index.fail("error", e.toString());
      }
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

