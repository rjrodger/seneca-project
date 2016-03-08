/* Copyright (c) 2013-2015 Richard Rodger and other contributors, MIT License */
"use strict";

var _     = require('lodash')
var async = require('async')

var nid = require('nid')


module.exports = function project( options ) {
  var seneca = this

  options = seneca.util.deepextend({
    name: 'project',
    base: 'sys',
    listname: 'projects',
    loadlimit: 3,
    web: true,
    idgen:{human:false,length:6}
  },options)

  options.prefix = options.prefix || '/'+options.name

  var plugin  = options.name

  var project_entname = options.base+'/'+options.name
  var account_entname = 'sys/account'
  var user_entname    = 'sys/user'

  seneca.depends(plugin,['user','account'])

  if( options.web ) {
    seneca.depends(plugin,['auth'])
  }

  var projnid
  if( options.idgen.short ) {
    projnid = nid({length:options.idgen.length})
  }

  seneca.add({role:plugin,cmd:'save'},       save_project)
  seneca.add({role:plugin,cmd:'start'},      start_project)
  seneca.add({role:plugin,cmd:'stop'},       stop_project)
  seneca.add({role:plugin,cmd:'move'},       move_project)
  seneca.add({role:plugin,cmd:'adduser'},    adduser)
  seneca.add({role:plugin,cmd:'removeuser'}, removeuser)
  seneca.add({role:plugin,cmd:'load'},       load_project)
  seneca.add({role:plugin,cmd:'list_users'}, list_users)
  seneca.add({role:plugin,cmd:'for_user'},   for_user)

  // legacy patterns
  seneca.add({role:plugin,cmd:'project_users'}, list_users)
  seneca.add({role:plugin,cmd:'user_projects'}, for_user)

  // FIX: deprecated, use a wrap instead
  var entmap = {
    account: seneca.make( account_entname ),
    user: seneca.make( user_entname ),
  }
  entmap[options.name] = seneca.make( project_entname )

  function additem( ent, refent, name ) {
    if( ent && refent && name ) {
      ent[name] = ent[name] || []
      ent[name].push( refent.id )
      ent[name] = _.uniq( ent[name] )
    }
  }

  function loadall( name, ent, list, done ) {
    async.mapLimit(list||[],options.loadlimit,function(id,cb){
      if( id && id.entity$ ) return cb(null,id);
      ent.load$(id,cb)

    }, function( err, list ) {
      if( err ) return done(err);

      var out = {}
      out[name] = list
      return done( null, out )
    })
  }

  function save_project( args, done ) {
    var projectent = this.make$( project_entname )

    var isnew = false

    var projectData = args.data
    var accountData = args.account

    if( projectData.id ) {
      projectent.load$(projectData.id, function( err, project ){
        if( err ) return done( err );
        return update_project( project )
      })
    }
    else {
      isnew = true
      var newproj = projectent.make$({id$:projectData.id$})


      if( projnid ) return genid();
      return update_project( newproj );
    }

    function genid() {
      newproj.id$ = projnid()
      projectent.load$(newproj.id$, function(err,found){
        if( err) return done(err);
        if( found ) return genid();
        return update_project( newproj );
      })
    }

    function update_project( project ) {

      // TODO: argprops to be deprecated
      var fields = seneca.util.argprops(

        // default values
        { kind:'primary' },

        // caller specified values, overrides defaults
        projectData,

        // controlled values, can't be overridden
        {
          active: void 0 == projectData.active ? true : !!projectData.active,
          account:accountData.id,
        },

        // invalid properties, will be deleted
        'id, role, cmd, user')

      project.data$(fields)

      project.save$( function( err, project ) {
        additem( accountData, project, options.listname)

        accountData.save$( function( err, account ) {
          if( err ) return done( err );

          var out = {account:account,new:isnew}
          out[options.name] = project
          done(null,out)
        })
      })
    }
  }

  function load_project( args, done ) {
    var out = {}
    // load via ensure_entity
    out[options.name] = args[options.name]
    done( null, out )
  }

  function start_project( args, done ) {
    args[options.name].active = true
    args[options.name].save$( function(err,project){
      var out = {ok:!err}
      out[options.name] = project
      return done(err,out)
    })
  }

  function stop_project( args, done ) {
    args[options.name].active = false
    args[options.name].save$( function(err,project){
      var out = {ok:!err}
      out[options.name] = project
      return done(err,out)
    })
  }

  function move_project( args, done ) {
    args[options.name].account = args.account.id
    args[options.name].save$( done )
  }

  function adduser( args, done ) {
    var user    = args.user
    var project = args[options.name]

    additem( user,    project, options.listname )
    additem( project, user,    'users' )

    project.save$( function( err, project ) {
      if( err ) return done(err);

      user.save$( done )
    })
  }

  function removeuser( args, done ) {
    var user    = args.user
    var project = args[options.name]

    user[options.name] = user[options.listname] || []
    user[options.name] =
      _.reject(user[options.listname],function(prjid){return prjid==project.id})

    project.users = project.users || []
    project.users =
      _.reject(project.users,function(usrid){return usrid==user.id})

    project.save$( function( err, project ){
      if( err ) return done(err);

      user.save$( done )
    })
  }

  function for_user( args, done ) {
    var projectent = this.make$( project_entname )

    var user = args.user

    // specifically assigned to projects
    var list = args.user[options.listname] ? _.clone(args.user[options.listname]) : []

    // all projects in account, if project has no specific users
    async.mapLimit(user.accounts||[],options.loadlimit,function(accid,cb){

      var q = {account:accid}
      if( void 0 != args.kind ) {
        q.kind = args.kind
      }

      projectent.list$({account:accid},function(err,projects){
        if( err ) return cb(err);

        _.each( projects, function( project) {
          if( project.users ) {
            if( _.contains( project.users, user.id ) ) {
              list.push( project.id )
            }
          }
          else {
            list.push( project.id )
          }
        })

        cb()
      })
    }, function( err, results ) {
      if( err ) return done(err);

      list = _.uniq(list)
      loadall( options.listname, projectent, list, function(err,out){
        if( err) return done(err);

        if( void 0 != args.kind ) {
          out[options.listname] = _.filter(out[options.listname],function(proj){
            return args.kind == proj.kind
          })
        }

        done(err,out)
      })
    })
  }

  function list_users( args, done ) {
    var project = args[options.name]

    // specifically assigned to project
    var list = project.users ? _.clone(project.users) : []

    var accountent = this.make$( account_entname )

    accountent.load$( project.account, function( err, account ) {
      if( err ) return err;

      list = list.concat( account.users || [] )
      list = _.uniq(list)

      var userent = this.make$( user_entname )

      loadall( 'users', userent, list, done )
    })
  }

  function buildcontext( req, res, args, act, respond ) {
    var user = req.seneca && req.seneca.user

    if( user ) {
      args.user = user

      if( args.account && !_.contains(args.user.accounts,args.account) ) {
        return seneca.fail({code:'invalid-account'},respond)
      }
      else {
        args.account = args.user.accounts[0]
      }
    }
    else return seneca.fail({code:'user-required'},respond);

    act(args,respond)
  }

  function init( args, done ){
    async.series
    ([
        function(cb){
          var projectent = seneca.make$( project_entname )
          seneca.act('role:util, cmd:define_sys_entity', {list:[projectent.canon$()]}, cb)
        },
        function(cb){
          seneca.act({
            role:'util',
            cmd:'ensure_entity',
            pin:{role:plugin,cmd:'*'},
            entmap:entmap
          }, cb)
        },
        function(cb){
          // web interface
          seneca.act_if(options.web, {role:'web', use:{
            prefix:options.prefix,
            pin:{role:plugin,cmd:'*'},
            map:{
              'for_user': { GET:buildcontext },
              'load':  { GET:buildcontext, alias:'load/:'+options.name },
              'save':  { POST:buildcontext, data: true },
              'start': { POST:buildcontext },
              'stop':  { POST:buildcontext },

              // legacy
              'user_projects': { GET:buildcontext },
            }
          }}, cb)
        }],
      done
    )
  }

  seneca.add({init:plugin}, init)

  return {
    name: plugin
  }
}
