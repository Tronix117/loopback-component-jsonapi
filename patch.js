function convertNullToNotFoundError(toModelName, ctx, cb) {
  if (ctx.result !== null) return cb();

  var fk = ctx.getArgByName('fk');
  var msg = 'Unknown "' + toModelName + '" id "' + fk + '".';
  var error = new Error(msg);
  error.statusCode = error.status = 404;
  error.code = 'MODEL_NOT_FOUND';
  cb(error);
}

function fixHttpMethod(fn, name) {
  if (fn.http && fn.http.verb && fn.http.verb.toLowerCase() === 'put') fn.http.verb = 'patch';
}

module.exports = function (app, options) {
  app.models().forEach(function(ctor) {
    // ctor.belongsToRemoting = function(relationName, relation, define) {
    //   var modelName = relation.modelTo && relation.modelTo.modelName;
    //   modelName = modelName || 'PersistedModel';
    //   var fn = this.prototype[relationName];
    //   var pathName = (relation.options.http && relation.options.http.path) || relationName;
    //   define('__get__' + relationName, {
    //     isStatic: false,
    //     http: {verb: 'get', path: '/' + pathName},
    //     accepts: {arg: 'refresh', type: 'boolean', http: {source: 'query'}},
    //     accessType: 'READ',
    //     description: 'Fetches belongsTo relation ' + relationName + '.',
    //     returns: {arg: relationName, type: modelName, root: true}
    //   }, fn);
    // };

    ctor.hasOneRemoting = function(relationName, relation, define) {
      var pathName = (relation.options.http && relation.options.http.path) || relationName;
      var toModelName = relation.modelTo.modelName;

      define('__get__' + relationName, {
        isStatic: false,
        http: {verb: 'get', path: '/' + pathName},
        accepts: {arg: 'refresh', type: 'boolean', http: {source: 'query'}},
        description: 'Fetches hasOne relation ' + relationName + '.',
        accessType: 'READ',
        returns: {arg: relationName, type: relation.modelTo.modelName, root: true}
      });

      var findHasOneRelationshipsFunc = function (cb) {
        this['__get__' + pathName](cb);
      }
      define('__findRelationships__' + relationName, {
        isStatic: false,
        http: {verb: 'get', path: '/relationships/' + pathName},
        description: 'Find relations for ' + relationName + '.',
        accessType: 'READ',
        returns: {arg: 'result', type: toModelName, root: true}
      }, findHasOneRelationshipsFunc);
    };

    ctor.hasManyRemoting = function(relationName, relation, define) {
      var pathName = (relation.options.http && relation.options.http.path) || relationName;
      var toModelName = relation.modelTo.modelName;

      var findHasManyRelationshipsFunc = function (cb) {
        this['__get__' + pathName](cb);
      }
      define('__findRelationships__' + relationName, {
        isStatic: false,
        http: {verb: 'get', path: '/relationships/' + pathName},
        description: 'Find relations for ' + relationName + '.',
        accessType: 'READ',
        returns: {arg: 'result', type: toModelName, root: true},
        rest: {after: convertNullToNotFoundError.bind(null, toModelName)}
      }, findHasManyRelationshipsFunc);

      var createRelationshipFunc = function (cb) {
        // this['__get__' + pathName](cb);
      }
      define('__createRelationships__' + relationName, {
        isStatic: false,
        http: {verb: 'post', path: '/relationships/' + pathName},
        description: 'Create relations for ' + relationName + '.',
        accessType: 'READ',
        returns: {arg: 'result', type: toModelName, root: true},
        rest: {after: convertNullToNotFoundError.bind(null, toModelName)}
      }, createRelationshipFunc);

      var updateRelationshipsFunc = function (cb) {
        // this['__get__' + pathName](cb);
      }
      define('__updateRelationships__' + relationName, {
        isStatic: false,
        http: {verb: 'patch', path: '/relationships/' + pathName},
        description: 'Update relations for ' + relationName + '.',
        accessType: 'READ',
        returns: {arg: 'result', type: toModelName, root: true},
        rest: {after: convertNullToNotFoundError.bind(null, toModelName)}
      }, updateRelationshipsFunc);

      var deleteRelationshipsFunc = function (cb) {
        // this['__get__' + pathName](cb);
      }
      define('__deleteRelationships__' + relationName, {
        isStatic: false,
        http: {verb: 'delete', path: '/relationships/' + pathName},
        description: 'Delete relations for ' + relationName + '.',
        accessType: 'READ',
        returns: {arg: 'result', type: toModelName, root: true},
        rest: {after: convertNullToNotFoundError.bind(null, toModelName)}
      }, deleteRelationshipsFunc);

      if (relation.modelThrough || relation.type === 'referencesMany') {
        var modelThrough = relation.modelThrough || relation.modelTo;

        var accepts = [];
        if (relation.type === 'hasMany' && relation.modelThrough) {
          // Restrict: only hasManyThrough relation can have additional properties
          accepts.push({arg: 'data', type: modelThrough.modelName, http: {source: 'body'}});
        }
      }
    };
    ctor.scopeRemoting = function(scopeName, scope, define) {
      var pathName =
        (scope.options && scope.options.http && scope.options.http.path) || scopeName;

      var isStatic = scope.isStatic;
      var toModelName = scope.modelTo.modelName;

      // https://github.com/strongloop/loopback/issues/811
      // Check if the scope is for a hasMany relation
      var relation = this.relations[scopeName];
      if (relation && relation.modelTo) {
        // For a relation with through model, the toModelName should be the one
        // from the target model
        toModelName = relation.modelTo.modelName;
      }

      define('__get__' + scopeName, {
        isStatic: isStatic,
        http: {verb: 'get', path: '/' + pathName},
        accepts: {arg: 'filter', type: 'object'},
        description: 'Queries ' + scopeName + ' of ' + this.modelName + '.',
        accessType: 'READ',
        returns: {arg: scopeName, type: [toModelName], root: true}
      });

    };
  });

  app.remotes().methods().forEach(fixHttpMethod);
}
