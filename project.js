/* Copyright (c) 2013 Richard Rodger, MIT License */
"use strict";


var _     = require('underscore')
var async = require('async')



module.exports = function( options ) {
  var seneca = this
  var plugin   = 'project'

  seneca.depends(plugin,['user','account'])


  options = seneca.util.deepextend({
    loadlimit:3,
    prefix: '/project',
    web:true
  },options)
  

  if( options.web ) {
    seneca.depends(plugin,['auth'])
  }


  var projectent = seneca.make$('sys/project')
  var accountent = seneca.make$('sys/account')
  var userent    = seneca.make$('sys/user')


  seneca.add({role:plugin,cmd:'save'},          save_project)
  seneca.add({role:plugin,cmd:'start'},         start_project)
  seneca.add({role:plugin,cmd:'stop'},          stop_project)
  seneca.add({role:plugin,cmd:'move'},          move_project)
  seneca.add({role:plugin,cmd:'adduser'},       adduser)
  seneca.add({role:plugin,cmd:'removeuser'},    removeuser)
  seneca.add({role:plugin,cmd:'project_users'}, project_users)
  seneca.add({role:plugin,cmd:'user_projects'}, user_projects)
  seneca.add({role:plugin,cmd:'load'},          load_project)



  seneca.act({
    role:'util',
    cmd:'ensure_entity',
    pin:{role:plugin,cmd:'*'},
    entmap:{
      account:accountent,
      project:projectent,
      user:userent,
    }
  })



  
  var pin = seneca.pin({role:plugin,cmd:'*'})




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
    if( args.id ) {
      projectent.load$(args.id, function( err, project ){
        if( err ) return done( err );
        return update_project( project )
      })
    }
    else return update_project( projectent.make$() );

    function update_project( project ) {
      var fields = seneca.util.argprops({}, args, {
        active: void 0 == args.active ? true : !!args.active,
        account:args.account.id
      }, 'id, role, cmd, user')

      project.data$(fields)

      project.save$( function( err, project ) {
        additem( args.account, project, 'projects')

        args.account.save$( function( err, account ) {
          if( err ) return done( err );

          done(null,{project:project})
        })
      })
    }
  }


  function load_project( args, done ) {
    done( null, {project:args.project} )
  }


  function start_project( args, done ) {
    args.project.active = false
    args.project.save$( done )
  }



  function stop_project( args, done ) {
    args.project.active = true
    args.project.save$( done )
  }



  function move_project( args, done ) {
    args.project.account = args.account.id
    args.project.save$( done )
  }



  function adduser( args, done ) {
    var user    = args.user
    var project = args.project

    additem( user,    project, 'projects' )
    additem( project, user,    'users' )

    project.save$( function( err, project ){
      if( err ) return done(err);

      user.save$( done )
    })
  }



  function removeuser( args, done ) {
    var user    = args.user
    var project = args.project

    user.projects = user.projects || []
    user.projects = _.reject(user.projects,function(prjid){return prjid==project.id})

    project.users = project.users || []
    project.users = _.reject(project.users,function(usrid){return usrid==user.id})

    project.save$( function( err, project ){
      if( err ) return done(err);

      user.save$( done )
    })
  }



  function user_projects( args, done ) {
    var user = args.user

    // specifically assigned to projects
    var list = args.user.projects ? _.clone(args.user.projects) : []

    // all projects in account, if project has no specific users
    async.mapLimit(user.accounts||[],options.loadlimit,function(accid,cb){
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

      loadall( 'projects', projectent, list, done )
    })
  }



  function project_users( args, done ) {
    var project = args.project

    // specifically assigned to project
    var list = project.users ? _.clone(project.users) : []
    
    accountent.load$( project.account, function( err, account ) {
      if( err ) return err;

      list = list.concat( account.users || [] )
      list = _.uniq(list)

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



  // web interface
  seneca.act_if(options.web, {role:'web', use:{
    prefix:options.prefix,
    pin:{role:plugin,cmd:'*'},
    map:{
      'user_projects': { GET:buildcontext },
      'load': { GET:buildcontext, alias:'load/:project' },
      'save': { POST:buildcontext }
    }
  }})




  seneca.add({init:plugin}, function( args, done ){
    seneca.act('role:util, cmd:define_sys_entity', {list:[projectent.canon$()]})
    done()
  })


  return {
    name: plugin
  }
}
