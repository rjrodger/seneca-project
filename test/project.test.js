/* Copyright (c) 2010-2013 Richard Rodger */
"use strict";

// mocha project.test.js


var seneca  = require('seneca')

var assert  = require('chai').assert

var gex    = require('gex')
var async  = require('async')
var _      = require('underscore')





function cberr(win){
  return function(err){
    if(err) {
      assert.fail(err, 'callback error')
    }
    else {
      win.apply(this,Array.prototype.slice.call(arguments,1))
    }
  }
}




var si = seneca()
si.use( 'user' )
si.use( 'auth' )
si.use( 'account' )
si.use( '..' )



var accountpin  = si.pin({role:'account',cmd:'*'})
var projectpin  = si.pin({role:'project',cmd:'*'})
var userpin     = si.pin({role:'user',cmd:'*'})

var accountent = si.make$('sys','account')
var projectent = si.make$('sys','project')
var userent    = si.make$('sys','user')


describe('user', function() {

  var tmp = {}
  
  it('create_account', function(fin) {
    accountent.make$({name:'A1'}).save$(cberr(function(a1){
      assert.isNotNull(a1)
      tmp.a1 = a1
      fin()
    }))
  })


  it('create_users', function(cb){
    userent.make$({name:'U1',nick:'u1'}).save$(cberr(function(u1){
      assert.isNotNull(u1)
      tmp.u1 = u1

      userent.make$({name:'U2',nick:'u2'}).save$(cberr(function(u2){
        assert.isNotNull(u2)
        tmp.u2 = u2

        cb()
      }))
    }))
  })
     

  it('add_users_to_account', function(cb){
    accountpin.add_user( { user:tmp.u1, account:tmp.a1 }, function( err, out ){
      assert.isNotNull(out.user)
      assert.isNotNull(out.account)
      assert.ok(_.contains(out.user.accounts,out.account.id))
      assert.ok(_.contains(out.account.users,out.user.id))
      tmp.u1 = out.user
      tmp.a1 = out.account
      cb()
    })
  })


  it('create_project', function(cb){
    projectpin.save({name:'p1',account:tmp.a1},cberr(function(out){
      tmp.p1 = out.project
      assert.equal( 'p1', tmp.p1.name )
      assert.equal( 'primary', tmp.p1.kind )

      tmp.a1.load$(cberr(function(a1){
        assert.ok( _.contains(a1.projects,tmp.p1.id) ) 

        cb()
      }))
    }))
  })
  
  
  it('user_projects', function(cb){
    projectpin.user_projects({user:tmp.u1.id},cberr(function(out){
      assert.ok(1==out.projects.length)
      assert.equal( out.projects[0].name, tmp.p1.name )
      assert.equal( out.projects[0].kind, tmp.p1.kind )
      cb()
    }))
  })

  it('project_users', function(cb){
    projectpin.project_users({project:tmp.p1},cberr(function(out){
      assert.ok(1==out.users.length)
      assert.equal(tmp.u1.id,out.users[0].id)

      projectpin.project_users({project:tmp.p1,kind:'primary'},cberr(function(out){
        assert.ok(1==out.users.length)
        assert.equal(tmp.u1.id,out.users[0].id)

        cb()
      }))
    }))
  })


  it('create_project_of_kind', function(cb){
    projectpin.save({name:'p2',account:tmp.a1,kind:'foo'},cberr(function(out){
      tmp.p2 = out.project
      assert.equal( 'p2', tmp.p2.name )
      assert.equal( 'foo', tmp.p2.kind )

      tmp.a1.load$(cberr(function(a1){
        assert.ok( _.contains(a1.projects,tmp.p2.id) ) 

        cb()
      }))
    }))
  })


  it('user_projects_of_kind', function(cb){
    projectpin.user_projects({user:tmp.u1.id,kind:'foo'},cberr(function(out){
      assert.ok(1==out.projects.length)
      assert.equal( out.projects[0].name, tmp.p2.name )
      assert.equal( out.projects[0].kind, tmp.p2.kind )
      assert.equal( out.projects[0].kind, 'foo' )
      cb()
    }))
  })

  
})

