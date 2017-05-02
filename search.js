// $(document).ready(doIt);

// function doIt () {
// }

$( function() {
  $.widget( "custom.catcomplete", $.ui.autocomplete, {
    _create: function() {
      this._super();
      this.widget().menu( "option", "items", "> :not(.ui-autocomplete-category)" );
    },
    _renderMenu: function( ul, items ) {
      var that = this,
          currentCategory = "";
      $.each( items, function( index, item ) {
        var li;
        if ( item.category != currentCategory ) {
          ul.append( "<li class='ui-autocomplete-category'>" + item.category + "</li>" );
          currentCategory = item.category;
        }
        li = that._renderItemData( ul, item );
        if ( item.category ) {
          li.attr( "aria-label", item.category + " : " + item.label );
        }
      });
    }
  });
  // var data = {
  //   tags: {
  //     "text-equiv-all": {
  //       "dev": ["captcha", "images", "text-alternatives", "video"],...}}}
  buildSearch("dev"); // "int", "con", "vis";
  $("#controls").on("change", evt => { renderResults(evt); });
  $("#search").
    on("blur", renderResults).
    on("keypress", evt => {
      if(evt.keyCode == 13) {
        renderResults(evt);
        return false;
      }
      return true;
  });
  $("#controls").on("change", hideAndRender);
  $("#source-button").on("click", toggleControls);
} );

var NowPlaying = null; // what type of search box we're using

function buildSearch (audience) {
  var autoCompleteSource = [];
  if ($("#context").is(":checked"))
    autoCompleteSource = autoCompleteSource.concat(Object.keys(context).reduce((ret, key) => {
      return ret.concat({ label: key, category: context[key].category });
    }, []));
  if ($("#purpose").is(":checked"))
    autoCompleteSource = autoCompleteSource.concat(Object.keys(purpose).reduce((ret, key) => {
      return ret.concat({ label: key, category: purpose[key].category });
    }, []));
  if ($("#meet").is(":checked"))
    autoCompleteSource = autoCompleteSource.concat(Object.keys(data.tags).reduce((ret, key) => {
      var k2 = key.replace(/-/g, " ");
      return audience in data.tags[key] ?
        data.tags[key][audience].reduce((r2, label) => {
          return r2.concat({ label: label, category: k2 });
        }, ret) :
      ret;
    }, []));
  // if (NowPlaying === "auto")
  //   $("#search").autocomplete("destroy");

  if (NowPlaying === "cat")
    $("#search").catcomplete("destroy");
  if (true || $("#category").is(":checked")) {
    $("#search").catcomplete({
      delay: 0,
      autoCompleteSource: autoCompleteSource
    });
    NowPlaying = "cat";
  } else {
    $("#search").autocomplete({
      delay: 0,
      autoCompleteSource: autoCompleteSource.reduce((ret, s) => {
        return ret.indexOf(s.label) === -1 ? ret.concat(s.label) : ret;
      }, [])
    });
    NowPlaying = "auto";
  }
}

function renderResults (evt) {
  debugger;
  var search = $("#search").val()
  var m;

  m = search.match(/\[(.*)\]/);
  if (m)
    search = m[1];
  else
    search = search.replace(/ *\(.*\)/, "");
  var sz = search.trim().split(/ /).map(s => {
    var singular = s, plural = s;
    if (s.endsWith("y"))
      plural = s.substr(0, s.length-1) + "ies";
    else if (s.endsWith("ies"))
      singlular = s.substr(0, s.length-3) + "y";
    else if (s.endsWith("s"))
      singular = s.substr(0, s.length-1);
    else
      plural = s + "s";
    return { singular: singular, plural: plural };
  });
  var tz = sz.reduce((ret, s) => {
    return ret.filter(t => {
      return data.techniques[t].title.match(s.singular) ||
        data.techniques[t].title.match(s.plural);
    });
  }, Object.keys(data.techniques));
  console.log(tz);

  function f (map) {
    return sz.reduce((ret, s) => {
      return ret.filter(t => {
        return t.match(s.singular) ||
          t.match(s.plural) ||
          map[t].match(s.singular) ||
          map[t].match(s.plural);
      });
    }, Object.keys(map))
  }
  $("#results").empty();
  if ($("#techniques").is(":checked"))
    $("#results").append(tz.map(technique => {
      return renderTechnique(technique, tz);
    }));
  if ($("#tutorials").is(":checked"))
    $("#results").append(renderMap(f(data.tutorials), "tutorials", tz));
  if ($("#perspectives").is(":checked"))
    $("#results").append(renderMap(f(data.perspectives), "perspectives", tz));


  function renderMap (map, label, ignoreRefsTo) {
    const _ex = {
      "https://www.w3.org/WAI/perspectives/contrast.html": "colors with good contrast",
    };

    if (map.length === 0)
      return "";
    var ul = $("<ul/>");
    ul.append(map.map(tutorial => {
      return $("<li><a href='"+tutorial+"'>"+tutorial+"</a></li>");
    }));
    return $("<div><h2>"+label+"</h2></div>").append(ul);
  }

  function renderTechnique (label, ignoreRefsTo) {
    const _ex = {
      "type": "G", "num": "131", "applicability": "All technologies.",
      "title": "Providing descriptive labels",
      "referenced": [
        {
          "success": {
            "link": "http://www.w3.org/TR/2008/REC-WCAG20-20081211/#navigation-mechanisms-descriptive",
            "text": "Success Criterion 2.4.6 (Headings and Labels)"
          },
          "meet": {
            "link": "http://www.w3.org/WAI/WCAG20/quickref/20160105/#navigation-mechanisms-descriptive",
            "text": "How to Meet 2.4.6 (Headings and Labels)"
          },
          "grok": {
            "link": "http://www.w3.org/TR/2016/NOTE-UNDERSTANDING-WCAG20-20161007/navigation-mechanisms-descriptive.html",
            "text": "Understanding Success Criterion 2.4.6 (Headings and Labels)"
          }
        }
      ],
      "examples": [
        { "link": "G131-ex1", "text": "Example 1: blah blah blah" } ],
      "resources": [
        { "link": "http:...", "text": "Do..." }
      ],
      "related": [ "TECH:H90" ]
    };
    var t = data.techniques[label];
    var ret = $("<div/>");
    ret.append("<h2>"+techniqueLabel(t)+"</h2>");
    ret.append("<p class='applicability'>"+t.applicability+"</p>");
    if ("referenced" in t) {
      var ul = $("<ul class='applicability'/>");
      ul.append(t.referenced.map(r => {
        return $("<li><a href='"+r.success.link+"'>"+r.success.text+"</a><ul>"+
                 "<li><a href='"+r.meet.link+"'>"+r.meet.text+"</a></li>"+
                 "<li><a href='"+r.grok.link+"'>"+r.grok.text+"</a></li>"+"</ul></li>");
      }));
      ret.append(ul);
    }
    if ("examples" in t) {
      ret.append(t.examples.map(e => {
        return $("<p class='example'><a href='https://www.w3.org/TR/WCAG20-TECHS/"+t.type+t.num+"#"+e.link+"'>"+e.text+"</a></p>");
      }));
    }
    if (false && "resources" in t && t.resources.length > 0) {
      var resources = $("<ul class='resources'/>");
      resources.append(t.resources.map(r => {
        return $("<li><a href='"+r.link+"'>"+r.text+"</a></li>");
      }));
      ret.append("<p class='resources'>see also:</p>", resources);
    }
    if ("related" in t) {
      var relatedToRender = t.related;
      if (ignoreRefsTo)
        relatedToRender = relatedToRender.filter(r => {
          return ignoreRefsTo.indexOf(r) === -1;
        });
      if (relatedToRender.length > 0) {
        var related = $("<ul class='related'/>");
        related.append(relatedToRender.map(r => {
          return $("<li><a href='https://www.w3.org/TR/WCAG20-TECHS/"+(r.replace(/^TECH:/, ""))+"'>"+techniqueLabel(data.techniques[r])+"</a></li>");
        }));
        ret.append("<p class='related'>related techniques:</p>", related);
      }
    }
    return ret;
  }

}

function hideAndRender (evt) {
  $("#controls").css("display", "none");
  return renderResults(evt);
}

function toggleControls (evt) {
  debugger;
  var hiding = $("#controls").css("display") === "flex";
  $("#controls").css("display", hiding ? "none" : "flex");
  if (!hiding) {
    var target = evt.target;
    while (target.tagName !== "BUTTON")
      target = target.parentElement;
    var bottonBBox = target.getBoundingClientRect();
    var controlsBBox = document.getElementById("controls").getBoundingClientRect();
    console.dir(bottonBBox);
    console.dir(controlsBBox);
    var left = bottonBBox.right - controlsBBox.width;
    $("#controls").css("top", bottonBBox.bottom).css("left", left);
  }
  return false;
}

function techniqueLabel (t) {
  const typeToLabel = {
    "G": "general", "H": "html", "C": "css", "SCR": "screen",
    "SVR": "server-side", "SM": "smil", "T": "text", "ARIA": "aria",
    "FLASH": "flash", "SL": "silverlight", "PDF": "PDF", "F": "f??"};
  return "<span class='id'>"+t.type+t.num+"</span> "+t.title+" <span class='type'>("+typeToLabel[t.type]+")</span>";
}

var context = {
  "label (tag)": { category: "forms" },
  "label [link text]": { category: "links" },
  "label [scope]": { category: "tables" },
  "label [alt text]": { category: "img" },
};

var purpose = {
  "label tag (form)": { category: "labels" },
  "link text": { category: "labels" },
  "scope tag": { category: "labels" },
  "alt text": { category: "labels" },
};

var data = {
  tags: {
    "text-equiv-all": {
      "dev": ["captcha", "images", "text-alternatives", "video"],
      "int": ["audio", "video", "buttons", "carousels", "captcha"],
      "vis": ["images", "images-of-text", "animation", "progress-steps", "text-alternatives", "video"],
      "con": ["audio", "captions", "content", "images", "live-stream", "moving-content", "text-alternatives", "video", "visual-cues", "buttons"] },
    "media-equiv-av-only-alt": {
      "dev": ["video", "text-alternatives"],
      "int": ["audio", "video"],
      "vis": ["animation", "text-alternatives", "video"],
      "con": ["audio", "captions", "content", "moving-content", "text-alternatives", "video"] },
    "media-equiv-captions": {
      "dev": ["video", "text", "text-alternatives"],
      "int": ["audio", "video"],
      "vis": ["animation", "text-alternatives", "video"],
      "con": ["audio", "captions", "content", "moving-content", "text-alternatives", "video"] },
    "media-equiv-audio-desc": {
      "dev": ["video"],
      "int": ["audio", "video"],
      "vis": ["animation", "video"],
      "con": ["content", "video"] },
    "media-equiv-real-time-captions": {
      "dev": ["video", "text", "text-alternatives"],
      "int": ["audio", "video", "streaming"],
      "vis": ["animation", "text-alternatives", "video"],
      "con": ["audio", "captions", "content", "live-stream"] },
    "media-equiv-audio-desc-only": {
      "dev": ["video"],
      "int": ["audio", "video", "streaming"],
      "vis": ["animation", "text-alternatives", "video"],
      "con": ["content", "live-stream", "video"] },
    "media-equiv-sign": {
      "dev": ["video"],
      "int": ["audio", "video"],
      "vis": ["video"],
      "con": ["audio", "content", "video"] },
    "media-equiv-extended-ad": {
      "dev": ["video"],
      "int": ["audio", "video"],
      "vis": ["animation", "video"],
      "con": ["content", "video"] },
    "media-equiv-text-doc": {
      "dev": ["video", "text", "text-alternatives", "images"],
      "int": ["audio", "video"],
      "vis": ["animation", "text-alternatives", "video"],
      "con": ["audio", "content", "video"] },
    "media-equiv-live-audio-only": {
      "dev": ["text", "text-alternatives"],
      "int": ["audio", "streaming"],
      "vis": ["text-alternatives"],
      "con": ["audio", "live-stream"] },
    "content-structure-separation-programmatic": {
      "dev": ["forms", "headings", "labels", "menus", "markup", "structure", "tables"],
      "int": ["buttons", "carousels", "changing-content", "controls", "errors", "forms", "modals", "navigation", "skip-to-content"],
      "vis": ["hidden-content", "layout", "progress-steps", "structure", "tables"],
      "con": ["consistent-experience", "content", "headings", "hidden-content", "progress-steps", "structure", "visual-cues"] },
    "content-structure-separation-sequence": {
      "dev": ["forms", "keyboard", "structure"],
      "int": ["buttons", "carousels", "controls", "errors", "focus", "forms", "navigation", "skip-to-content", "tab-order"],
      "vis": ["hidden-content", "layout", "progress-steps", "structure", "tables"],
      "con": ["consistent-experience", "content", "hidden-content", "messaging", "progress-steps", "structure"] },
    "content-structure-separation-understanding": {
      "dev": ["text"],
      "int": ["buttons", "controls", "errors", "navigation"],
      "vis": ["color", "layout", "structure"],
      "con": ["audio", "consistent-experience", "content", "messaging", "visual-cues"] },
    "visual-audio-contrast-without-color": {
      "int": ["buttons", "controls", "errors", "focus", "forms", "navigation"],
      "vis": ["color", "text"],
      "con": ["content", "links", "messaging", "text"] },
    "visual-audio-contrast-dis-audio": {
      "dev": ["controls", "video"],
      "int": ["audio", "autoplay", "controls", "streaming", "video"],
      "con": ["buttons"] },
    "visual-audio-contrast-contrast": {
      "int": ["buttons", "errors", "focus", "forms", "navigation"],
      "vis": ["color", "contrast", "images-of-text", "text"],
      "con": ["content", "messaging"] },
    "visual-audio-contrast-scale": {
      "dev": ["text"],
      "vis": ["layout", "text", "zoom"] },
    "visual-audio-contrast-text-presentation": {
      "dev": ["images", "text"],
      "int": ["buttons"],
      "vis": ["contrast", "images-of-text", "text", "text-alternatives"],
      "con": ["content", "images", "text", "text-alternatives"] },
    "visual-audio-contrast7": {
      "int": ["buttons", "errors", "focus", "forms", "navigation"],
      "vis": ["color", "contrast", "images-of-text", "text"],
      "con": ["content", "messaging"] },
    "visual-audio-contrast-noaudio": {
      "dev": ["captcha", "video"],
      "int": ["audio", "autoplay", "controls", "streaming", "captcha"] },
    "visual-audio-contrast-visual-presentation": {
      "dev": ["controls", "text"],
      "int": ["controls"],
      "vis": ["color", "contrast", "layout", "structure", "text", "zoom"],
      "con": ["content", "structure", "text"] },
    "visual-audio-contrast-text-images": {
      "dev": ["images", "text"],
      "int": ["buttons"],
      "vis": ["contrast", "images", "images-of-text", "text", "text-alternatives"],
      "con": ["consistent-experience", "structure", "text"] },
    "keyboard-operation-keyboard-operable": {
      "dev": ["controls", "focus", "keyboard", "events", "video"],
      "int": ["autoplay", "buttons", "carousels", "controls", "errors", "focus", "forms", "events", "navigation", "streaming", "video", "tab-order", "skip-to-content"],
      "con": ["links", "messaging"] },
    "keyboard-operation-trapping": {
      "dev": ["controls", "focus", "keyboard", "events", "video"],
      "int": ["autoplay", "buttons", "carousels", "controls", "errors", "focus", "forms", "events", "navigation", "streaming", "video", "tab-order", "skip-to-content"] },
    "keyboard-operation-all-funcs": {
      "dev": ["controls", "focus", "keyboard", "events", "video"],
      "int": ["autoplay", "buttons", "carousels", "controls", "errors", "focus", "forms", "events", "navigation", "streaming", "video", "tab-order", "skip-to-content"] },
    "time-limits-required-behaviors": {
      "dev": ["controls"],
      "int": ["controls", "time-limits"] },
    "time-limits-pause": {
      "dev": ["controls", "video"],
      "int": ["audio", "autoplay", "carousels", "changing-content", "controls", "video", "time-limits"],
      "vis": ["blinking", "animation", "video"],
      "con": ["buttons"] },
    "time-limits-no-exceptions": {
      "dev": ["controls"],
      "int": ["controls", "time-limits"] },
    "time-limits-postponed": {
      "dev": ["controls"],
      "int": ["controls", "errors", "changing-content", "time-limits"] },
    "time-limits-server-timeout": {
      "int": ["forms", "time-limits"],
      "vis": ["text"] },
    "seizure-does-not-violate": {
      "vis": ["flashing", "animation"],
      "con": ["content", "video", "moving-content"] },
    "seizure-three-times": {
      "vis": ["flashing", "animation"],
      "con": ["content", "video", "moving-content"] },
    "navigation-mechanisms-skip": {
      "dev": ["headings", "menus", "markup", "structure", "iframes"],
      "int": ["navigation", "skip-to-content"],
      "vis": ["layout", "structure"],
      "con": ["headings"] },
    "navigation-mechanisms-title": {
      "dev": ["page-title"],
      "int": ["navigation"],
      "vis": ["structure", "progress-steps"],
      "con": ["content", "page-title", "structure"] },
    "navigation-mechanisms-focus-order": {
      "dev": ["errors", "focus", "forms", "keyboard", "links", "menus", "events"],
      "int": ["buttons", "carousels", "controls", "errors", "focus", "forms", "modals", "events", "navigation", "skip-to-content", "tab-order"],
      "vis": ["structure"],
      "con": ["buttons"] },
    "navigation-mechanisms-refs": {
      "dev": ["links", "menus"],
      "int": ["buttons", "navigation"],
      "con": ["content", "links", "buttons"] },
    "navigation-mechanisms-mult-loc": {
      "dev": ["menus"],
      "int": ["navigation"],
      "vis": ["structure"] },
    "navigation-mechanisms-descriptive": {
      "dev": ["errors", "forms", "headings", "labels", "menus", "tables"],
      "int": ["errors", "forms", "navigation"],
      "vis": ["text"],
      "con": ["content", "headings", "messaging"] },
    "navigation-mechanisms-focus-visible": {
      "dev": ["controls", "focus", "keyboard", "menus"],
      "int": ["controls", "focus", "navigation", "skip-to-content", "tab-order"],
      "vis": ["color", "contrast", "progress-steps"],
      "con": ["buttons"] },
    "navigation-mechanisms-location": {
      "dev": ["menus"],
      "int": ["navigation"] },
    "navigation-mechanisms-link": {
      "dev": ["menus", "links"],
      "int": ["buttons", "navigation"],
      "con": ["content", "links", "buttons"] },
    "navigation-mechanisms-headings": {
      "dev": ["headings", "markup", "structure"],
      "vis": ["structure", "text"],
      "con": ["content", "headings", "progress-steps"] },
    "meaning-doc-lang-id": {
      "dev": ["language", "text"],
      "vis": ["text"] },
    "meaning-other-lang-id": {
      "dev": ["language", "text"],
      "vis": ["text"] },
    "meaning-idioms": {
      "dev": ["text", "markup"],
      "vis": ["text"],
      "con": ["content"] },
    "meaning-located": {
      "dev": ["text", "markup"],
      "vis": ["text"],
      "con": ["content"] },
    "meaning-supplements": {
      "vis": ["text"],
      "con": ["content"] },
    "meaning-pronunciation": {
      "vis": ["text"],
      "con": ["content"] },
    "consistent-behavior-receive-focus": {
      "dev": ["controls", "focus", "forms", "menus", "events"],
      "int": ["controls", "forms", "events", "navigation"] },
    "consistent-behavior-unpredictable-change": {
      "dev": ["controls", "forms", "menus", "events"],
      "int": ["controls", "forms", "events", "navigation"] },
    "consistent-behavior-consistent-locations": {
      "dev": ["menus"],
      "int": ["navigation"],
      "vis": ["layout", "progress-steps"],
      "con": ["progress-steps"] },
    "consistent-behavior-consistent-functionality": {
      "dev": ["controls", "forms", "menus", "structure"],
      "int": ["buttons", "controls", "forms", "modals", "navigation"],
      "vis": ["progress-steps", "structure"],
      "con": ["consistent-experience", "content", "visual-cues", "buttons"] },
    "consistent-behavior-no-extreme-changes-context": {
      "dev": ["controls", "forms", "menus", "events"],
      "int": ["controls", "forms", "events", "navigation"] },
    "minimize-error-identified": {
      "dev": ["controls", "errors", "focus", "forms", "labels"],
      "int": ["controls", "errors", "focus", "forms"],
      "con": ["content"] },
    "minimize-error-cues": {
      "dev": ["controls", "focus", "forms", "labels"],
      "int": ["controls", "errors", "focus", "forms"],
      "con": ["content", "messaging", "progress-steps", "visual-cues"] },
    "minimize-error-suggestions": {
      "dev": ["controls", "errors", "focus", "forms", "labels"],
      "int": ["controls", "errors", "focus", "forms"],
      "con": ["content", "messaging"] },
    "minimize-error-reversible": {
      "dev": ["errors", "forms"],
      "int": ["errors", "forms"],
      "con": ["content", "messaging"] },
    "minimize-error-context-help": {
      "dev": ["errors", "forms", "text"],
      "int": ["errors"],
      "vis": ["text"],
      "con": ["content", "messaging"] },
    "minimize-error-reversible-all": {
      "dev": ["errors", "forms"],
      "int": ["errors", "forms"],
      "con": ["content"] },
    "ensure-compat-parses": {
      "dev": ["markup", "structure"] },
    "ensure-compat-rsv": {
      "dev": ["markup", "structure", "forms", "labels", "menus", "video"],
      "con": ["messaging", "moving-content"] }
  },
  tutorials: {
    "https://www.w3.org/WAI/tutorials/menus/application/": "We welcome your ideas \n\n        Menus Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/menus/styling/": "Vertical Menu Horizontal menu Indicating hover and focus Indicating the current page Related WCAG 2.0 resources We welcome your ideas \n\n        Menus Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/tables/two-headers/": "Table with header cells in the top row and first column Table with an offset column of header cells Related WCAG 2.0 resources We welcome your ideas \n\n        Tables Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/tables/multi-level/": "Table with multiple column headers in each column Table with three headers related to each data cell Split up multi-level tables Related WCAG 2.0 resources We welcome your ideas \n\n        Tables Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/images/groups/": "Multiple images conveying a single piece of information A collection of images Related WCAG 2.0 resources We welcome your ideas \n\n        Images Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/tables/irregular/": "Table with two tier headers Table with headers spanning multiple rows or columns Related WCAG 2.0 resources We welcome your ideas \n\n        Tables Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/tables/caption-summary/": "Identifying a table using a caption Summaries for more complex tables Related WCAG 2.0 resources We welcome your ideas \n\n        Tables Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/menus/flyout/": "Enhancing the menu using JavaScript Improve screen reader support using WAI-ARIA Related WCAG 2.0 resources We welcome your ideas \n\n        Menus Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/images/complex/": "Long descriptions Description containing structured information Description containing textual information Related WCAG 2.0 resources We welcome your ideas \n\n        Images Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/images/textual/": "Styled text with decorative effect Image of text used as an unlinked logo Mathematical expressions Related WCAG 2.0 resources We welcome your ideas \n\n        Images Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/images/tips/": "Tips Other W3C Resources We welcome your ideas \n\n        Images Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/tables/one-header/": "Table with header cells in the top row only Table with header cells in the first column only Table with ambiguous data Related WCAG 2.0 resources We welcome your ideas \n\n        Tables Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/menus/multiple-ways/": "Breadcrumbs Sitemap Search Multiple ways to activate functions in applications Related WCAG 2.0 resources We welcome your ideas \n\n        Menus Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/page-structure/content/": "Paragraphs Lists Definition lists Quotes Figures Images and illustrations Tables Related WCAG 2.0 resources We welcome your ideas \n\n        Page Structure Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/carousels/structure/": "Carousel framework Item structure Carousel styling Related WCAG 2.0 resources We welcome your ideas \n\n        Carousels Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/images/functional/": "Image used alone as a linked logo Logo image within link text Icon image conveying information within link text Stand-alone icon image that has a function Image used in a button Related WCAG 2.0 resources We welcome your ideas \n\n        Images Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/images/informative/": "Images used to label other information Images used to supplement other information Images conveying succinct information Images conveying an impression or emotion Images conveying file format Related WCAG 2.0 resources We welcome your ideas \n\n        Images Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/images/decision-tree/": "We welcome your ideas \n\n        Images Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/page-structure/styling/": "Visual clarity Font size Text alignment Line length Highlight section Related WCAG 2.0 resources We welcome your ideas \n\n        Page Structure Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/carousels/animations/": "Stop button Pause when focused Hiding in-transition elements from assistive technologies Finalized carousel Related WCAG 2.0 resources We welcome your ideas \n\n        Carousels Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/page-structure/sections/": "Common page sections Labeling sections Related WCAG 2.0 resources We welcome your ideas \n\n        Page Structure Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/menus/structure/": "List of Links Identifying the menu Labeling navigations Related WCAG 2.0 resources We welcome your ideas \n\n        Menus Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/page-structure/in-page-navigation/": "Anchors Skip links Table of contents Related WCAG 2.0 resources We welcome your ideas \n\n        Page Structure Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/menus/undefined": "Site Navigation Footer Navigation",
    "https://www.w3.org/WAI/tutorials/images/decorative/": "Image used as part of page design Decorative image as part of a text link Image with adjacent text alternative Image used for ambience (eye-candy) Related WCAG 2.0 resources We welcome your ideas \n\n        Images Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/carousels/undefined": "Site Navigation Footer Navigation",
    "https://www.w3.org/WAI/tutorials/carousels/functionality/": "Displaying carousel items Switching carousel items Indicating carousel items Focusing carousel items Putting it all together Related WCAG 2.0 resources We welcome your ideas \n\n        Carousels Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/images/imagemap/": "An organizational chart with links to individual pages Related WCAG 2.0 resources We welcome your ideas \n\n        Images Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/tables/tips/": "Other W3C Resources We welcome your ideas \n\n        Tables Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/forms/grouping/": "Associating related controls with fieldset Associating related controls with WAI-ARIA Grouping items in select elements Related WCAG 2.0 resources We welcome your ideas \n\n        Forms Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/forms/instructions/": "Overall instructions In-line instructions Related WCAG 2.0 resources We welcome your ideas \n\n        Forms Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/page-structure/headings/": "Heading levels Organize main page content Organize page sections Related WCAG 2.0 resources We welcome your ideas \n\n        Page Structure Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/forms/validation/": "Validating required input Validating common input Validating patterned input Be forgiving of different input formats Client-side validation benefits Validation by the user Related WCAG 2.0 resources We welcome your ideas \n\n        Forms Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/images/undefined": "Site Navigation Footer Navigation",
    "https://www.w3.org/WAI/tutorials/tables/undefined": "Site Navigation Footer Navigation",
    "https://www.w3.org/WAI/tutorials/page-structure/undefined": "Site Navigation Footer Navigation",
    "https://www.w3.org/WAI/tutorials/forms/undefined": "Site Navigation Footer Navigation",
    "https://www.w3.org/WAI/tutorials/forms/custom-controls/": "A Share Button A Star Rating We welcome your ideas \n\n        Forms Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/forms/notifications/": "Overall feedback In-line feedback Related WCAG 2.0 resources We welcome your ideas \n\n        Forms Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/forms/multi-page/": "Indicating progress Related WCAG 2.0 resources We welcome your ideas \n\n        Forms Tutorial\n\n     \n  All Tutorials\n Document Information",
    "https://www.w3.org/WAI/tutorials/forms/labels/": "Associating labels explicitly Associating labels implicitly Labelling buttons Visual position of label text Related WCAG 2.0 resources We welcome your ideas \n\n        Forms Tutorial\n\n     \n  All Tutorials\n Document Information"
  },
  perspectives: {
    "https://www.w3.org/WAI/perspectives/contrast.html": "colors with good contrast",
    "https://www.w3.org/WAI/perspectives/keyboard.html": "keyboard compatibility",
    "https://www.w3.org/WAI/perspectives/notifications.html": "notifications and feedback",
    "https://www.w3.org/WAI/perspectives/customizable.html": "customizable text",
    "https://www.w3.org/WAI/perspectives/understandable.html": "understandable content",
    "https://www.w3.org/WAI/perspectives/speech.html": "text to speech",
    "https://www.w3.org/WAI/perspectives/captions.html": "video captions",
    "https://www.w3.org/WAI/perspectives/voice.html": "voice recognition",
    "https://www.w3.org/WAI/perspectives/controls.html": "large links, buttons, and controls",
    "https://www.w3.org/WAI/perspectives/layout.html": "clear layout and design"
  },
  principles: principles,
  techniques: techniques
};
