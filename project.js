/* Copyright (c) 2013 Richard Rodger, MIT License */
"use strict";


var _     = require('underscore')
var async = require('async')



module.exports = function( options ) {
  var seneca = this
  var name   = 'project'

  seneca.depends(name,['user','account'])


  options = seneca.util.deepextend({
    loadlimit:3
  },options)
  


  var projectent = seneca.make$('sys','project')
  var accountent = seneca.make$('sys','account')
  var userent    = seneca.make$('sys','user')


  seneca.add({role:name,cmd:'create'},        create_project)
  seneca.add({role:name,cmd:'start'},         start_project)
  seneca.add({role:name,cmd:'stop'},          stop_project)
  seneca.add({role:name,cmd:'move'},          move_project)
  seneca.add({role:name,cmd:'adduser'},       adduser)
  seneca.add({role:name,cmd:'removeuser'},    removeuser)
  seneca.add({role:name,cmd:'project-users'}, project_users)
  seneca.add({role:name,cmd:'user-projects'}, user_projects)



  seneca.act({
    role:'util',
    cmd:'ensure_entity',
    pin:{role:name,cmd:'*'},
    entmap:{
      account:accountent,
      project:projectent,
      user:userent,
    }
  })



  
  var pin = seneca.pin({role:name,cmd:'*'})




  function additem( ent, refent, name ) {
    if( ent && refent && name ) {
      ent[name] = ent[name] || []
      ent[name].push( refent.id )
      ent[name] = _.uniq( ent[name] )
    }
  }



  function loadall( ent, list, done ) {
    async.mapLimit(list||[],options.loadlimit,function(id,cb){
      if( id && id.entity$ ) return cb(null,id);
      ent.load$(id,cb)
    }, done )
  }


  
  function create_project( args, done ) {
    projectent.make$(_.extend({},args,{
      name: args.name,
      active: void 0 == args.active ? true : !!args.active,
      account:args.account.id

    })).save$( function( err, project ) {
      additem( args.account, project, 'projects')

      args.account.save$( function( err, account ) {
        if( err ) return done( err );

        done(null,project)
      })
    })
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

      loadall( projectent, list, done )
    })
  }



  function project_users( args, done ) {
    var project = args.project

    // specifically assigned to project
    var list = project.users ? _.clone(project.users) : []
    
    console.log(project)
    console.log(list)

    accountent.load$( project.account, function( err, account ) {
      if( err ) return err;

      console.log(account)

      list = list.concat( account.users || [] )
      list = _.uniq(list)

      loadall( userent, list, done )
    })
  }




  seneca.add({init:name}, function( args, done ){
    seneca.act('role:util, cmd:define_sys_entity', {list:[projectent.canon$()]})
  })


  return {
    name: name
  }
}
