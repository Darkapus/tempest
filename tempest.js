function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}
function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"), 'g'), replace);
}

(function(old) {
  $.fn.attr = function() {
    if(arguments.length === 0) {
      if(this.length === 0) {
        return null;
      }

      var obj = {};
      $.each(this[0].attributes, function() {
        if(this.specified) {
          obj[this.name] = this.value;
        }
      });
      return obj;
    }

    return old.apply(this, arguments);
  };
})($.fn.attr);

 $.fn.hasAttr = function(name,val){
    if(val){
        return $(this).attr(name) === val;
    }
    return $(this).attr(name) !== undefined;
};


$.jsonBaseUrl = '';
$.templatePath = '/static/html/{{tagName}}.html';
$.templateEvents = [];

// determine le nombre d'appels ajax
var activeAjaxConnections = 0;



jQuery.fn.extend({

    component: function(){
        var object = this

        return {
            render: function(destination){
                var templatePath = $.templatePath
                
                // la destination du rendu
                if(!destination){
                    destination = object
                }   
                
                if(object.hasAttr("component")){
                    var tagName = object.prop("tagName")

                    if(tagName==undefined) return false;
                    if(object.hasAttr('stop')) return false;

                    tagName = tagName.toLowerCase()
                    if(object.attr('component')){
                        templatePath = object.attr('component')
                    }
                    
                    // on recupere le tag, ca va nous permettre de construire l'url en fonction du tag
                    if(tagName.indexOf('_')==-1){
                        tagName += '_default'
                    }
                    templatePath = templatePath.replace('{{tagName}}', tagName.replace(/_/g, '/'))
                    
                    // on ajoute default si pas de _ qui seront ensuite remplacé par des / pour construire l'url de destination
                    if(tagName.indexOf("_") == -1){
                        tagName += '_default'
                    }

                    var current = this // current = object courant, soit component et non pas $(this)
                    
                    $.ajax( {
                        url:templatePath,
                        method:'GET',
                        beforeSend: function(xhr) {activeAjaxConnections++;}
                    }).error(function(){
                        activeAjaxConnections--;
                        if(activeAjaxConnections==0){
                            $.launch()
                        }
                    }).success( function( data ) {
                        activeAjaxConnections--;

                        // suppression de l'attribut component
                        object.removeAttr('component')

                        // on recupere les attributs restants du composant pour injection
                        attributes = object.attr()
                        
                        // construction des valeur de remplacement pour la template
                        content = {}

                        // pour le balisage du prioritaire au moins prioritaire 
                        // 1. les attribues
                        // 2. les balises <>
                        // 3. les request
                        // 4. les config js

                        // on recupere ce qu'il y a dans les config
                        if(CONFIG != undefined){
                            $.each(CONFIG, function(index, value){
                                content[index] = value
                            })
                        }

                        // on recupere ce qu'il y a dans le request et on ajoute. permet le replacement dans les balises
                        $.each($.url().param(), function(index, value){
                            content[index] = value
                        })

                        // on remplacer les balises dans la template par [[nom_balise]]
                        object.children().each(function(){
                            content[$(this).prop("tagName").toLowerCase()] = $(this).html()
                        });

                        // les attribut ou balises permettent de surcharger également les balise [[]]
                        $.each(attributes, function(index,value){
                            content[index] = value
                        })

                        // on supprime header car inutile
                        object.children('header').replaceWith('');
                        // on supprime footer car inutile
                        object.children('footer').replaceWith('');

                        // traitement du body (le reste)
                        content.body = object.html()
                        
                        // templatage
                        //Mustache.parse(data, ["[[", "]]"]);
                        
                        // on constuit la template
                        // data ici est le html rendu par ajax
                        tpl = object.template()
                        tpl.set(data)
                        newDom = tpl.getWithData(content, ['[[',']]'])
                        
                        $.each(attributes, function(index,value){
                            if(index != 'callback'){
                                newDom.attr(index, value)
                            }
                        })
                        
                        // on remplace l'objet courant par le nouvel
                        destination.replaceWith(newDom);
                        
                        // serait bien de débugger la partie suivante
                        // Il rend 2 fois lorsque le controle se fait sur object.prop("tagName")
                        // l'idée serait de ne pas lancer le check si déja lancé pour l'objet
                        newDom.each(function(){
                            $(this).component().render()
                        });

                        // on lance le callback du component
                        // le callback est lancé avec l'objet rendu et non pas celui du dom component
                        if(object.hasAttr('callback')){
                            window[object.attr('callback')](newDom) 
                        }

                        newDom.find('[json]').addClass('hidden')

                        if(activeAjaxConnections==0){
                            $.launch()
                        }
                    });
                }
                else{
                    this.checkEventAfterRender();

                    // inutile de rendre sur component puisque ce n'est qu'une template de composant
                    // on exclu les {{ [[ pour éviter d'apperler des url avec variables non templatées
                    if(object.hasAttr('json') && object.attr('json').indexOf('{{')==-1 && object.attr('json').indexOf('[[')==-1){
                        //console.log('json appelé sur composant '+object.prop("tagName")+' avec url suivante '+object.attr('json') )
                        //console.log(object.attr('json'))
                        template = object.template()

                        // initialisation de la template pour garder en mémoire
                        template.init()

                        // on load en fonction de l'attribut puis suppression de l'attribut
                        // on load dans la template en replaceWith
                        // est utilisé l'attribut callback et json
                        // json fonctionne que sur le dom non component
                        object.jsonLoader(template).load()
                    }
                    else{
                        // on lance les callback du dom (si pas json)
                        object.callback()
                        // on supprime le stop pour cosmetique
                        // le stop empeche d'aller plus loin dans le dom pour le rendu
                        if(object.hasAttr('stop')){
                            object.removeAttr('stop');
                        }
                        else{
                            // on fait du recursif component
                            this.renderChildren()
                        }
                    }
                }
                //sleep(100)
                return true
            },
            checkEventAfterRender: function(){
                $.template().launchEventFor(object)

                if(object.hasAttr('destroy')){
                    object.destroy()
                }
                return this
                
            },
            renderChildren: function(){
                object.children().each(function(){
                    $(this).component().render()
                });
            },
            load: function(url, append, method){
                var current = this

                if(method==undefined){
                    method = 'GET';
                }
                $.ajax( {"url":url, "method":method,beforeSend: function(xhr) {activeAjaxConnections++;}})
                .error(function(){
                    activeAjaxConnections--;
                    if(activeAjaxConnections==0){
                        $.launch()
                    }})
                .success(
                    function( data ) {
                        activeAjaxConnections--;
                        if(append){
                            newDom = $("<loader><h1><span class='glyphicon glyphicon-download'></span></h1></loader>")
                            object.append(newDom)
                            $(data).component().render(newDom)
                        }
                        else{
                            newDom = $("<loader></h1><span class='glyphicon glyphicon-download'></span></h1></loader>")
                            object.html(newDom)
                            $(data).component().render(newDom)   
                        }
                        if(activeAjaxConnections==0){
                            $.launch()
                        }
                    
                })
            }
        }
    },
    template: function(){
        var object = this

        return {
            init: function(){ // on stock la template, pour le cadre d'un raffraichissement par json par exemple
                return jQuery.data(object[0], "templateSrc", object.html())
                return this
            },
            set: function(content){ // le set du template
                return jQuery.data(object[0], "templateSrc", content)
                return this
            },
            get: function(){
                return jQuery.data(object[0], "templateSrc")
            },
            htmlWithData: function(data){
                var newDom = this.getWithData(data)
                
                //console.log(object)
                // on fait le rendu en fonction de la template
                //console.log(object.prop('tagName'))
                object.html('')
                var allcomp = []
                newDom.each(function(){
                    // on rend ce qui est nouveau
                    if($(this).context.nodeName=="#text"){
                        // si texte $(this).context.data
                        // si texte pur pas besoin de traitement complémentaire
                        object.append($(this).context.data)
                    }
                    else{
                        var comp = $($(this).wrapAll('<div>').parent().html())
                        object.append(comp)
                    }  
                })

                if(object.hasAttr('stop')){
                    object.removeAttr('stop');
                }
                else{
                    // on fait du recursif component
                    object.component().renderChildren()
                }

                return object
            },
            replaceWithData: function(data){
                var newDom = this.getWithData(data)

                // on fait le rendu en fonction de la template
                object.replaceWith(newDom);

                // on rend ce qui est nouveau
                newDom.component().render()

                return newDom
            },
            getWithData: function(data, tags){
                if(tags){
                    if(!this.get()){
                        this.init();
                    }

                    content = this.get();

                    content = replaceAll(content, '{{','|x');
                    content = replaceAll(content, '}}','x|');

                    content = replaceAll(content, '[[','{{');
                    content = replaceAll(content, ']]','}}');

                    var template = Handlebars.compile(content);
                    var rendered = template(data);

                    //rendered = Mustache.render(data, content);
                    rendered = replaceAll(rendered, '|x', '{{');
                    rendered = replaceAll(rendered, 'x|', '}}');

                    // decode en html entities pour bien construire le dom
                    decode = object.decodeEntities(rendered)

                    // le dom sera intégré en tant que composant jquery
                    return $(decode)
                }
                else{
                    //Handlebars.setDelimiter('{{','}}');
                    if(!this.get()){
                        this.init();
                    }
                    var template = Handlebars.compile(this.get());

                    var rendered = template(data);
                    
                    return $(rendered)
                }
            }
        }
    },

    jsonLoader: function(template){
        var object = this
        if(template == undefined){
            template = object.template()
        }

        return {
            setData: function(content){ // le set du template
                return jQuery.data(object[0], "jsonData", content)
            },
            getData: function(){
                return jQuery.data(object[0], "jsonData")
            },
            byAttr: function(callback){
                if(object.hasAttr('json')){

                    var url = object.attr('json')

                    if(url.substring(0,1) == '='){
                        // transformation de la chaine en JSON puis lancement
                        // console.log(jQuery.parseJSON(url.substring(1)))
                        // on conserve la data
                        this.setData(jQuery.parseJSON(url.substring(1)))
                        // on map la data
                        this.byData(callback)
                    }
                    else if(url){

                        this.byUrl($.jsonBaseUrl+url, callback) 
                    }
                    // suppression de l'attribut pour éviter de recommencer
                    //object.removeAttr('json')
                }
            },
            byUrl: function(url, callback){
                var current = this
                
                $.ajax( {url:url,dataType:"json",beforeSend: function(xhr) {activeAjaxConnections++;}}).success( function( data ) {
                    activeAjaxConnections--
                    // on conserve la data
                    current.setData(data)
                    // on map la data
                    current.byData(callback)
                    
                    if(activeAjaxConnections==0){
                        $.launch()
                    }

                }).error(function() {
                    activeAjaxConnections--
                    // on affiche dans le console log pour avoir une trace quelque part
                    console.log( "erreur de traitement json sur : "+url );
                    //console.log("==="+object.prop('tagName')+"===")
                    //console.log("-url "+object.attr('json'));
                    //console.log($('body').html())
                    if(activeAjaxConnections==0){
                        $.launch()
                    }
                  })
            },
            byData: function(callback){
                // rendu du dom avec mustache + la data du json
                var newDom = template.htmlWithData(this.getData())

                if(callback != undefined){
                    callback()    
                }
                // rendu du composant, on recommence la routine car le nouveau composant remplace l'ancien
                // le callback n'est pas remplacé c'est l'un des seuls element du dom qui n'est pas remonté
                newDom.callback()

                // on affiche ce qui est caché. Precedemment on a caché tout ce qui était sous le json par soucis cosmetique
                newDom.removeClass('hidden')
            },
            load: function(url, callback){

                if(url){
                    this.byUrl(url, callback) 
                }
                else{
                    this.byAttr(callback)
                }
            }
        }
    },

    decodeEntities: function(input) {
        return $.decodeEntities(input)
    },
    destroy: function(){
        this.replaceWith('')
    },
    callback: function(){
        if(this.hasAttr('callback')){
            //console.log(this.attr('callback'))
            window[this.attr('callback')](this) 
            //this.removeAttr('callback')
        }   
    },
    jsonReload: function(callback){
        this.jsonLoader().load(undefined, callback)
    }
});
function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}
jQuery.decodeEntities = function(input){
    var y = document.createElement('textarea');
    y.innerHTML = input;
    
    return y.value;
}

$.launch = function(){
    console.log('Fin des appels')
}
jQuery.template = function(){
    
    return {
        render: function(object, launch){
            if(launch != undefined){
                this.rendered(launch)
            }
            return object.component().render()
        },
        ready: function(ev){
            $.templateEvents.push(ev)
        },
        getEvents: function(){
            return $.templateEvents
        },
        launchEventFor: function(object){
            for(i=0; i<this.getEvents().length; i++){
                this.getEvents()[i](object)
            }
        },
        rendered: function(launch){
            $.launch = launch;
        }
    }
}
