/**
 * @lint ignoreUndefined(q, samples, hljs)
 */
q.ready(function() {
  // remove the warning
  q("#warning").setStyle("display", "none");

  // global storage for the method index
  var data = {};

  // plugin toggle
  q("#plugintoggle").on("click", function() {
    var txt = this.getChildren("span");
    var hide = txt.getHtml() == "show";
    txt.setHtml(hide ? "hide" : "show");
    q(".plugin").setStyle("display", hide ? "block" : "none");
    q("li.plugin").setStyle("display", hide ? "list-item" : "none");
  });


  // load API data of q
  q.io.xhr("script/q.json").send().on("loadend", function(xhr) {
    if (xhr.readyState == 4 && xhr.status >= 200 && xhr.status < 400) {
      var ast = JSON.parse(xhr.responseText);

      // constructor
      var construct = getByType(ast, "constructor");
      data["Core"] = {"static" : [], "member": []};
      data["Core"]["static"].push(getByType(construct, "method"));

      createData(ast);
      renderList();
      renderContent();
      onContentReady();
    } else {
      q("#warning").setStyle("display", "block");
      if (location.protocol.indexOf("file") == 0) {
        q("#warning em").setHtml("File protocol not supported. Please load the application via HTTP.");
      }
    }
  });

  // load event normalization modules
  var norm = q.env.get("q.eventtypes");
  if (norm) {
    norm = norm.split(",");
    norm.forEach(function(name) {
      loading++;
      q.io.xhr("script/" + name + ".json").send().on("loadend", function(xhr) {
        loading--;
        if (xhr.readyState == 4 && xhr.status >= 200 && xhr.status < 400) {
          var ast = JSON.parse(xhr.responseText);
          renderEventNorm(ast);
        } else {
          console && console.warn("Event normalization '" + name + "' could not be loaded.");
        }
      });
    });
  }


  var eventNormAsts = [];
  var renderEventNorm = function(ast) {
    eventNormAsts.push(ast);
    if (q.env.get("q.eventtypes").split(",").length > eventNormAsts.length) {
      return;
    }

    q("#list").append(q.create("<h1>Event Types</h1>"));
    for (var i=0; i < eventNormAsts.length; i++) {
      renderClass(eventNormAsts[i], "event.");
    };
  };


  var loadedClasses = [];
  var loadClass = function(name) {
    if (loadedClasses.indexOf(name) != -1) {
      return;
    }
    loadedClasses.push(name);
    loading++;
    q.io.xhr("script/" + name + ".json").send().on("loadend", function(xhr) {
      loading--;
      if (xhr.readyState == 4 && xhr.status >= 200 && xhr.status < 400) {
        var ast = JSON.parse(xhr.responseText);
        renderClass(ast);
      } else {
        name = name.split(".");
        name = name[name.length -1];
        q("#content").append(
          q.create("<h1>" + name + "</h1><p style='color: #C00F00'><em>Failed to load " + name + " documentation!</em></p>")
        );
      }
      onContentReady();
    });
  }



  /**
   * DATA PROCESSING
   */
  var desc = "";
  var createData = function(ast) {
    desc = ast.attributes.desc || "";
    attachData(getByType(ast, "methods-static"), "static");
    attachData(getByType(ast, "methods"), "member");
    // sort all methods
    for (var module in data) {
      data[module]["static"].sort(sortMethods);
      data[module]["member"].sort(sortMethods);
    }
  };


  var attachData = function(ast, type) {
    ast && ast.children.forEach(function(item) {
      // skip internal methods
      if (isInternal(item)) {
        return;
      }
      var module = getModuleName(item.attributes.sourceClass);
      if (!data[module]) {
        data[module] = {"static": [], "member": [], fileName: item.attributes.sourceClass};
      }
      data[module][type].push(item);
    });
  };


  var sortMethods = function(a, b) {
    return a.attributes.name > b.attributes.name ? 1 : -1;
  };


  /**
   * LIST
   * @lint ignoreUndefined(q)
   */
  var renderList = function() {
    var keys = getDataKeys();
    q("#list").append(q.create("<h1>Modules</h1>"));
    for (var i = 0; i < keys.length; i++) {
      var module = keys[i];
      renderListModule(module, data[module]);
    }
  };


  var renderListModule = function(name, data, prefix) {
    var list = q("#list");
    if (prefix && prefix != "event.") {
      list.append(q.create("<a href='#" + name + "'><h1>" + name + "</h1></a>"));
    } else {
      list.append(q.create("<a href='#" + name + "'><h2>" + name + "</h2></a>"));
    }

    var ul = q.create("<ul></ul>").appendTo(list);
    data["static"].forEach(function(ast) {
      var name = getMethodName(ast, prefix);
      q.template.get("list-item", {name: name + "()", link: name, plugin: isPluginMethod(name)}).appendTo(ul);
    });
    data["member"].forEach(function(ast) {
      var name = getMethodName(ast, prefix);
      q.template.get("list-item", {name: name + "()", link: name, plugin: isPluginMethod(name)}).appendTo(ul);
    });
  };


  /**
   * CONTENT
   */
   var renderContent = function() {
     var keys = getDataKeys();
     for (var i = 0; i < keys.length; i++) {
       renderModule(keys[i], data[keys[i]]);
     }
   };


   var renderModule = function(name, data, prefix) {
     // render module desc
     var module = q.create("<div class='module'>").appendTo("#content");
     module.append(q.create("<h1 id='" + name + "'>" + name + "</h1>"));

     if (data.fileName) {
       addClassDoc(data.fileName, module);
     } else if (data.desc) {
       module.append(parse(data.desc));
     }

     if (data.events) {
       var eventsEl = renderEvents(data.events);
       if (eventsEl) {
         module.append(eventsEl);
       }
     }

     if (data.types) {
       var types = JSON.parse(data.types);
       for (var i=0; i < types.length; i++) {
         if (types[i] == "*") {
           types[i] = "all";
         }
       };
       var typesEl = renderTypes(types);
       module.append(typesEl);
     }

     data["static"].forEach(function(method) {
       renderMethod(method, prefix);
     });
     data["member"].forEach(function(method) {
       renderMethod(method, prefix);
     });
   };


  var renderMethod = function(method, prefix) {
    // skip internal methods
    if (isInternal(method)) {
      return;
    }
    // add the name
    var data = {name: getMethodName(method, prefix)};

    // module
    data.module = getModuleName(method.attributes.sourceClass);

    // add the description
    data.desc = parse(getByType(method, "desc").attributes.text) || "";

    // add the return type
    var returnType = getByType(method, "return");
    if (returnType) {
      data.returns = {desc: parse(getByType(returnType, "desc").attributes.text || "")};
      data.returns.types = [];
      getByType(returnType, "types").children.forEach(function(item) {
        var type = item.attributes.type;
        data.returns.types.push(type);
        if (IGNORE_TYPES.indexOf(type) == -1 && MDC_LINKS[type] == undefined) {
          loadClass(type);
        }
      });
    }
    data.returns.printTypes = printTypes;

    // add the parameters
    data.params = [];
    var params = getByType(method, "params");
    for (var j=0; j < params.children.length; j++) {
      var param = params.children[j];
      var paramData = {name: param.attributes.name};
      paramData.desc = parse(getByType(param, "desc").attributes.text || "");
      if (param.attributes.defaultValue) {
        paramData.defaultValue = param.attributes.defaultValue;
      }
      paramData.types = [];
      var types = getByType(param, "types");
      for (var k=0; k < types.children.length; k++) {
        var type = types.children[k];
        paramData.types.push(type.attributes.type);
      };
      paramData.printTypes = printTypes;
      data.params.push(paramData);
    };
    data.printParams = printParams;
    data.paramsExist = data.params.length > 0;

    data.plugin = isPluginMethod(data.name);

    q("#content").append(q.template.get("method", data));
  }


  var addClassDoc = function(name, parent) {
    if (name) {
      name = name.split("#")[0];
    } else {
      parent.append(desc);
      return;
    }
    loading++;
    q.io.xhr("script/" + name + ".json").send().on("loadend", function(xhr) {
      loading--;
      if (xhr.readyState == 4 && xhr.status >= 200 && xhr.status < 400) {
        var ast = JSON.parse(xhr.responseText);
        // class doc
        var desc = getByType(ast, "desc");
        if (desc && desc.attributes && desc.attributes.text) {
          parent.append(parse(desc.attributes.text));
        }

        var eventsEl = renderEvents(getEvents(ast));
        if (eventsEl) {
          parent.append(eventsEl);
        }
      } else {
        parent.append(
          q.create("<p style='color: #C00F00'><em>Failed to load module documentation!</em></p>")
        );
      }
      onContentReady();
    });
  }


  var getEvents = function(ast) {
    var events = getByType(ast, "events");
    var data = [];
    events.children.forEach(function(event) {
      var name = event.attributes.name;
      var desc = getByType(event, "desc").attributes.text;
      var type = getByType(event, "types").children[0].attributes.type;
      data.push({name: name, type: addTypeLink(type), desc: desc});
    });
    return data;
  };


  var renderEvents = function(events) {
    if (events.length == 0) {
      return null;
    }
    return q.template.get("events", {events: events});
  };


  var renderTypes = function(types) {
    return q.template.get("types", {types: types});
  };


  var printParams = function() {
    var params = "";
    for (var i = 0; i < this.params.length; i++) {
      params += this.params[i].name;
      if (i < this.params.length - 1) {
        params += ", ";
      }
    }
    return params;
  };

  var printTypes = function() {
    var params = "";
    for (var i = 0; i < this.types.length; i++) {
      params += addTypeLink(this.types[i]);
      if (i < this.types.length - 1) {
        params += ", ";
      }
    }
    return params;
  };


  var renderClass = function(ast, prefix) {
    var module = {"member": [], "static" : []};

    getByType(ast, "methods").children.forEach(function(method) {
      // skip internal methods
      if (isInternal(method)) {
        return;
      }
      module.member.push(method);
    });

    getByType(ast, "methods-static").children.forEach(function(method) {
      // skip internal methods
      if (isInternal(method)) {
        return;
      }
      module["static"].push(method);
    });
    var name = ast.attributes.name;

    // event normalization types
    var constants = getByType(ast, "constants");
    for (var i=0; i < constants.children.length; i++) {
      var constant = constants.children[i];
      if (constant.attributes.name == "TYPES") {
        module.types = constant.attributes.value;
        break;
      }
    };

    renderListModule(name, module, prefix || name + ".");
    module.desc = getByType(ast, "desc").attributes.text || "";
    module.events = getEvents(ast);

    renderModule(name, module, prefix || name + ".");
  };


  /**
   * PARSER
   */
   var parse = function(text) {
     if (!text) {
       return;
     }
     // @links: methods
     text = text.replace(/\{@link .*#(.*?)\}/g, "<code><a href='#.$1'>.$1()</a></code>");
     // @links: core
     text = text.replace(/\{@link q\}/g, "<a href='#Core'>Core</a>");
     // @links: modules
     var links;
     var regexp = /\{@link (.*?)\}/g;
     while ((links = regexp.exec(text)) != null) {
       var name = getModuleName(links[1]);
       text = text.replace(links[0], "<a href='#" + name + "'>" + name + "</a>");
     }
     return text;
   };


  /**
   * FINALIZE
   */
  var loading = 0;
  var onContentReady = function() {
    if (loading > 0) {
      return;
    }
    // enable syntax highlighting
    q('pre').forEach(function(el) {hljs.highlightBlock(el)});

    loadSamples();
  }


  var loadSamples = function() {
    q.io.script("samples.js").send().on("loadend", function() {
      for (var method in samples) {
        var selector = "#" + method.replace(".", "\\.");
        q(selector).append(q.create("<h4>Examples</h4>"));
        for (var i=0; i < samples[method].length; i++) {
          var sample = samples[method][i].toString();
          sample = sample.substring(sample.indexOf("\n") + 1, sample.length - 2);
          var sampleElement = q(selector);
          if (sampleElement[0]) {
            hljs.highlightBlock(q.create("<pre>").appendTo(sampleElement).setHtml(sample)[0]);
          } else {
            console && console.warn("Sample could not be attached for '", method, "'.")
          }
        };
      }
      // finally, jump to the selected item
      if (location.hash) {
        location.href = location.href;
      }
    });
  };


  /**
   * HELPERS
   */
   var getDataKeys = function() {
     var keys = Object.keys(data);
     keys.sort(function(a, b) {
       if (a == "Core") {
         return -1;
       }
       return a < b ? -1 : +1;
     });
     return keys;
   };


  var getByType = function(ast, type) {
    for (var i=0; i < ast.children.length; i++) {
      var item = ast.children[i];
      if (item.type == type) {
        return item;
      }
    };
    return {attributes: {}, children: []};
  };


  var getModuleName = function(attach) {
   if (!attach) {
     return "Core";
   }
   attach = attach.replace("qx.module.", "");
   return attach;
  };


  var isInternal = function(item) {
    return item.attributes.isInternal ||
      item.attributes.access == "private" ||
      item.attributes.access == "protected";
  };


  var isPluginMethod = function(name) {
    return name.indexOf(".$") != -1;
  };


  var getMethodName = function(item, prefix) {
    var attachData = getByType(item, "attachStatic");
    if (prefix) {
      if (!item.attributes.isStatic) {
        prefix = prefix.toLowerCase();
      }
      return prefix + item.attributes.name;
    } else if (item.attributes.name == "ctor") {
      return "q";
    } else if (item.attributes.isStatic) {
      return "q." + (attachData.attributes.targetMethod || item.attributes.name);
    } else {
      return "." + item.attributes.name;
    }
  };


  var addTypeLink = function(type) {
    if (type == "q") {
      return "<a href='#Core'>q</a>";
    } else if (MDC_LINKS[type]) {
      return "<a target='_blank' href='" + MDC_LINKS[type] + "'>" + type + "</a>";
    } else if (IGNORE_TYPES.indexOf(type) == -1) {
      var name = type.split(".");
      name = name[name.length -1];
      return "<a href='#" + name + "'>" + name + "</a>";
    }
    return type;
  };

  var IGNORE_TYPES = ["q", "var", "null"];

  var MDC_LINKS = {
    "Event" : "https://developer.mozilla.org/en/DOM/event",
    "Window" : "https://developer.mozilla.org/en/DOM/window",
    "Document" : "https://developer.mozilla.org/en/DOM/document",
    "Element" : "https://developer.mozilla.org/en/DOM/element",
    "Node" : "https://developer.mozilla.org/en/DOM/node",
    "Date" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Date",
    "Function" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function",
    "Array" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array",
    "Object" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object",
    "Map" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object",
    "RegExp" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/RegExp",
    "Error" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error",
    "Number" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Number",
    "Boolean" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Boolean",
    "String" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String",
    "undefined" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/undefined",
    "arguments" : "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/arguments",
    "Font" : "https://developer.mozilla.org/en/CSS/font",
    "Color" : "https://developer.mozilla.org/en/CSS/color"
  };

});