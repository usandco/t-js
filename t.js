$.fn.exists = function() {
    return this.length > 0;
}

$.fn.hasAttr = function(name) {  
   var attr = this.attr(name);
   return typeof attr !== 'undefined' && attr !== false;
};

window.t = typeof window.t !== "undefined" ? window.t : {
    models: {},
    collections: {},
    components: {},
    controllers: {},
    libraries: {
        Adapters: {}
    },
    app: {}
};
var t = typeof t !== "undefined" ? t : window.t;

t.libraries.App = Stapes.subclass({
    Views: {},
    Controller: {},
    isCordova: false,
    config: {
    },
    constructor: function(controller, config){
        var self = this;
        this.config = _.extend(this.config, (typeof config === "undefined" ? {} : config));
        this.isCordova = !!window.cordova;
        if(this.isCordova){
            this.cordovaExclude();
            $(document).on("deviceready", function(){
                self.init(controller);
            })
        }else{
            $(document).on("ready", function(){
                self.init(controller);
            })
        }
    },
    init: function(controller){
        var self = this;
        this.bodyFix();
        this.statusBar();
        this.initCollections();
        this.loadViews();
        this.Views.on("ready", function(){
            self.Controller = new t.controllers[controller]();
        })
    },
    cordovaExclude: function(){
        $("t-cordova-exclude").each(function(){
            // TODO: This isn't working, find out why
            $(this).remove();
        });
    },
    initCollections: function(){
        _.each(t.models, function(model, name){
            // TODO: Check if collection is already initialised before attempting to create a new instance
            t.collections[name] = typeof t.collections[name] === "undefined" ? new t.libraries.Collection(model) : new t.collections[name](model);
            model.proto({
                collection: t.collections[name]
            });
        });
    },
    loadViews: function(){
        this.Views = new t.libraries.Views();
    },
    bodyFix: function(){
        $("body").width($(window).width());
        $("body").height($(window).height());
    },
    statusBar: function(){
        if(this.isCordova){
            StatusBar.overlaysWebView(true);
            StatusBar.styleLightContent();
        }
    }
});

t.libraries.Component = Stapes.subclass({
    attr: {},
    $view: {},
    controller: {},
    constructor: function($el, attrs){
        this.attr = attrs;
    }
});

t.libraries.View = Stapes.subclass({
    
});
    
t.libraries.Views = Stapes.subclass({
    constructor: function(dir){
        var self = this;
        this.dir = typeof dir !== "undefined" ? dir : "app/views/";
        this.staged = [];
        this.history = [];
        this.loadAllViews();
        this.on("views-loaded", function(){
            self.loadAllComponents();
        })
        this.on("components-loaded", function(){
            self.emit("ready");
        })
        
    },
    loadAllViews: function(){
        var self = this;
        var views = $("t-views").children("t-view[src]");
        var N = views.length;
        if(N > 0){
            views.each(function(){
                self.include($(this), self.dir, function(){
                    N -= 1;
                    if(N < 1){
                        self.emit("views-loaded");
                    }
                })
            })
        }else{
            self.emit("views-loaded");
        }
    },
    loadAllComponents: function(){
        var self = this;
        var components = $("t-views > t-components").children("t-component[src]");
        var N = components.length;
        if(N > 0){
            components.each(function(){
                self.include($(this), self.dir + "components/", function($el){
                    N -= 1;
                    if(N < 1){
                        self.emit("components-loaded");
                    }
                })
            })
        }else{
            self.emit("components-loaded");
        }
    },
    include: function($el, dir, onComplete){
        var self = this;
        var src = $el.attr("src");
        src = dir + src + "?" + Date.now();
        $.get(src, function(html, status){
            var result = status === "error" ? false : true;
            if(!result){
                console.error("t Cannot include file: " + src);
            }else{
                html = self.comment(html);
                $el.html(html);
            }
            onComplete($el, result, html);
        })
    },
    comment: function(html){
        html = "<!--[[ " + html + " ]]-->";
        return html;
    },
    uncomment: function(html){
        html = html.replace("<!--[[ ", "");
        html = html.replace(" ]]-->", "");
        return html;
    },
    registerComponents: function(components, $view, controller){
        var self = this;
        _.each(components, function(name){
            var $component = $('t-components > t-component[name="' + name + '"]');
            self.registerComponent($component, name, $view, controller);
        })
    },
    registerComponent: function($component, name, $view, controller){
        var self = this;
        var attrString = $component.attr("attributes");
        attrString = attrString.split(" ").join("")
        var attrs = attrString.split(",");
        rivets.components[name] = {
            template: function(){
                return self.uncomment($component.html());
            },
            initialize: function(el){
                var $el = $(el);
                var attributes = {};
                _.each(attrs, function(attr){
                    attributes[attr] = $el.attr(attr);
                });
                
                var componentController = typeof t.components[name] !== "undefined" ? new t.components[name]($el, attributes) : new t.libraries.Component($el, attributes);
                componentController.$view = $view;
                componentController.controller = controller;
                
                return componentController;
            }
        }
    },
    stage: function($view, controller, show, hide){
        show = typeof show !== "function" ? controller.show : show;
        hide = typeof hide !== "function" ? controller.hide : hide;
        
        var html = $view.html();
        html = this.uncomment(html);
        
        var name = $view.attr("name") + "-view";
        
        if($(name).exists()){
            var stagedID = parseInt($(name).attr("data-staged-id"));
            $(name).remove();
            this.staged[stagedID] = null;
        }
        
        var stagedID = this.staged.length;
        $view = $("<" + name + "/>").attr({
            "class": "view",
            "data-staged-id": stagedID
        }).html(html).hide();
        
        var view = new (t.libraries.View.subclass({
            id: stagedID,
            name: name,
            $view: $view,
            controller: controller,
            show: show,
            hide: hide
        }));
        
        view.$view.appendTo("t-canvas");
        
        this.staged.push(view);
        
        return view;
    },
    show: function(view){
        this.hideOthers(view);
        t.app.emit("view-show");
        view.show();
        this.history.push(view.id);
    },
    hideOthers: function(view){
        t.app.emit("view-hide");
        _.each(this.staged, function(View){
            if(View !== null){
                if(view.name !== View.name){
                    View.hide();
                }
            }
        });
    }
})

t.libraries.Controller = Stapes.subclass({
    render: function(viewID, components, onShow, onHide){
        var $view = $('t-views > t-view[name="' + viewID + '"]');
        var view = t.app.Views.stage($view, this, onShow, onHide);
        t.app.Views.registerComponents(components, $view, this);
        rivets.bind(view.$view, this);
        t.app.Views.show(view);
    },
    show: function(){
        this.$view.fadeIn();
    },
    hide: function(){
        this.$view.fadeOut();
    },
    showLoading: function(){
        $("t-loading").show().velocity({ opacity: 1 }, { duration: 800 });
    },
    hideLoading: function(){
        $("t-loading").velocity({ opacity: 0 }, { duration: 800, display: "none" });
    },
    _construct: function(controller, args){
        function Controller() {
            return controller.apply(this, args);
        }
        Controller.prototype = controller.prototype;
        return new Controller();
    },
    goTo: function(controller, args){
        t.app.Controller = this._construct(t.controllers[controller], args);
    },
    goto: function(e, self){
        var controller = $(this).attr("href");
        self.goTo(controller);
        return false;
    },
    back: function(e, self){
        var history = t.app.Views.history;
        var controller = $(this).attr("href");
        if(history.length > 1){
            history.splice(-1, 1);
            var lastHistoryID = history.length - 1;
            var stagedID = history[lastHistoryID];
            var view = t.app.Views.staged[stagedID];
            history.splice(-1, 1);
            if(typeof view !== "null"){
                t.app.Views.show(view);
            }else{
                self.goTo(controller);
            }
        }else{
            self.goTo(controller);
        }
        
        return false;
    }
})

t.libraries.Model = Stapes.subclass({
    constructor: function(data){
        if(typeof data === "object"){
            this.extend(data);
        }
    }
});

t.libraries.Collection = Stapes.subclass({
    objects: [],
    adapter: function(){
        return {};
    },
    constructor: function(model){
        this.model = model;
        this.adapter = typeof this.adapter === "function" ? this.adapter() : this.adapter;
        this.clear();
    },
    clear: function(){
        this.objects = [];
        return this;
    },
    create: function(data, push){
        push = typeof push === "undefined" ? true : push;
        var object = new this.model(data);
        if(push){
            this.objects.push(object);
        }
        return object;
    },
    createObjects: function(items, empty){
        empty = typeof empty === undefined ? true : empty;
        var self = this;
        if(empty){
            this.objects = [];
        }
        _.each(items, function(item){
            self.create(item);
        })
    },
    query: function(method, data, callback){
        var self = this;
        if(typeof this.adapter.query === "function" ){
            this.adapter.query(method, data, function(data){
                self.callback("query", callback, data);
            });
        }else{
            this.callback("query", callback);
        }
    },
    get: function(onComplete, conditions){
        var self = this;
        if(typeof this.adapter.get === "function" ){
            this.adapter.get(function(data){
                if(data !== false){
                    var object = self.create(data, false);
                    self.callback("get", onComplete, object);
                }else{
                    self.callback("get", onComplete);
                }
            }, conditions)
        }else{
            this.callback("get", onComplete);
        }
        return this;
    },
    getAll: function(onComplete, conditions){
        var self = this;
        if(typeof this.adapter.getAll === "function" ){
            this.adapter.getAll(function(data){
                if(data !== false){
                    self.createObjects(data);
                    self.callback("getAll", onComplete, self.objects);
                }else{
                    self.callback("getAll", onComplete);
                }
            }, conditions)
        }else{
            this.callback("getAll", onComplete);
        }
        return this;
    },
    callback: function(event, callback, data){
        if(typeof callback === "function"){
            callback(data);
        }
        this.emit(event, data);
    },
    empty: function(){
        if(typeof this.objects === "undefined"){
            return true;
        }else if(this.objects.length < 1){
            return true;
        }else{
            return false;
        }
    }
});

t.libraries.Adapters.jsonFile = Stapes.subclass({
    src: "",
    localCache: false,
    constructor: function(src){
        this.src = src;
    },
    get: function(callback, conditions){
        var pullNew = true;
        if(this.localCache !== false){
            if(typeof conditions !== "undefined"){
                var data = _.findWhere(this.localCache, conditions);
            }else{
                var data = this.localCache;
            }
            if(typeof data !== "undefined"){
                pullNew = false;
                callback(data);
            }
        }
        if(pullNew){
            $.ajax({
                dataType: "json",
                url: this.src  + "?" + Date.now(),
                success: function(data){
                    if(typeof conditions !== "undefined"){
                        data = _.findWhere(data, conditions);
                        data = typeof data === "undefined" ? false : data;
                    }else{
                        data = data[0];
                    }
                    callback(data);
                },
                error: function(){
                    callback(false);
                }
            })
        }
    },
    getAll: function(callback, conditions){
        var self = this;
        $.ajax({
            dataType: "json",
            url: this.src  + "?" + Date.now(),
            success: function(data){
                if(typeof conditions !== "undefined"){
                    data = _.where(data, conditions);
                }
                self.localCache = data;
                callback(data);
            },
            error: function(){
                callback(false);
            }
        })
    }
})

t.libraries.Adapters.socket = Stapes.subclass({
    host: "",
    socket: false,
    modelName: "",
    constructor: function(modelName, forceNew){
        this.host = t.app.config.socketHost;
        this.modelName = modelName;
        forceNew = typeof forceNew === "undefined" ? false : forceNew;
        
        if(forceNew){
            t.app.socket = io(this.host);
        }else{
            t.app.socket = typeof t.app.socket === "undefined" ? io(this.host) : t.app.socket;
        }
        this.socket = t.app.socket;
    },
    query: function(method, data, callback){
        var request ={
            data: data
        } ;
        request.action = this.modelName + ":" + method;
        this.socket.removeAllListeners(request.action);
        this.socket.emit(request.action, request);
        this.socket.on(request.action, function(response){
            callback(response);
        });
    },
    get: function(callback, conditions){
        var pullNew = true;
        callback(true);
    },
    getAll: function(callback, conditions){
        callback(true);
    }
})