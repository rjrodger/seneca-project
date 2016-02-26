/* Copyright (c) 2010-2013 Richard Rodger */
"use strict";

var seneca  = require('seneca')
var assert  = require('chai').assert

var gex    = require('gex')
var async  = require('async')
var _      = require('lodash')
var async  = require('async')

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var suite = lab.suite
var test = lab.test
var before = lab.before

suite('project', function () {
  var si

  var accountent
  var userent

  var tmp = {}

  before({}, function (done) {
    si = seneca()
    si.use( 'user' )
    si.use( 'auth' )

    si.use( 'account' )
    si.use( '..' )

    si.ready(function(err){
      assert.ok(!err)

      accountent = si.make$('sys','account')
      userent    = si.make$('sys','user')

      done()
    })
  })

  test('create_account', function (done) {
    accountent.make$({name:'A1'}).save$( function(err, a1){
      assert.isNull(err)
      assert.isNotNull(a1)
      tmp.a1 = a1
      done()
    })
  })
  test('create_users', function (done) {
    async.series([
      function(cb) {
        userent.make$({name:'U1',nick:'u1'}).save$(function(err, u1) {
          assert.isNull(err)
          assert.isNotNull(u1)
          tmp.u1 = u1
          cb()
        })
      },
      function (cb) {
        userent.make$({name: 'U2', nick: 'u2'}).save$(function (err, u2) {
          assert.isNull(err)
          assert.isNotNull(u2)
          tmp.u2 = u2
          cb()
        })
      }], done)
  })
  test('add_users_to_account', function (done) {
    si.act('role: account, cmd: add_user', { user:tmp.u1, account:tmp.a1 }, function( err, out ){
      assert.isNotNull(out.user)
      assert.isNotNull(out.account)
      assert.ok(_.contains(out.user.accounts,out.account.id))
      assert.ok(_.contains(out.account.users,out.user.id))
      tmp.u1 = out.user
      tmp.a1 = out.account
      done()
    })
  })
  test('create_project', function (done) {
    si.act('role: project, cmd: save', {data: {name:'p1'},account:tmp.a1},function(err, out){
      assert.isNull(err)
      assert.isNotNull(out)
      assert.isNotNull(out.project)

      tmp.p1 = out.project
      assert.equal( 'p1', tmp.p1.name )
      assert.equal( 'primary', tmp.p1.kind )

      tmp.a1.load$(function(err, a1){
        assert.isNull(err)
        assert.isNotNull(a1)
        assert.ok( _.contains(a1.projects,tmp.p1.id) )

        done()
      })
    })
  })
  test('user_projects', function(done){
    si.act('role: project, cmd: user_projects', {user:tmp.u1.id}, function(err, out){
      assert.isNull(err)
      assert.isNotNull(out)

      assert.ok(1==out.projects.length)
      assert.equal( out.projects[0].name, tmp.p1.name )
      assert.equal( out.projects[0].kind, tmp.p1.kind )
      done()
    })
  })
  test('project_users', function(done){
    si.act('role: project, cmd: project_users', {project:tmp.p1},function(err, out){
      assert.isNull(err)
      assert.isNotNull(out)
      assert.isNotNull(out.users)

      assert.ok(1==out.users.length)
      assert.equal(tmp.u1.id,out.users[0].id)

      si.act('role: project, cmd: project_users', {project:tmp.p1,kind:'primary'},function(err, out){
        assert.isNull(err)
        assert.isNotNull(out)
        assert.isNotNull(out.users)

        assert.ok(1==out.users.length)
        assert.equal(tmp.u1.id,out.users[0].id)

        done()
      })
    })
  })
  test('create_project_of_kind', function(done){
    si.act('role: project, cmd: save', { data: {name:'p2', kind:'foo'}, account:tmp.a1},function(err, out){
      assert.isNull(err)
      assert.isNotNull(out)
      assert.isNotNull(out.project)

      tmp.p2 = out.project

      assert.equal( 'p2', tmp.p2.name )
      assert.equal( 'foo', tmp.p2.kind )

      tmp.a1.load$(function(err, a1){
        assert.isNull(err)
        assert.isNotNull(a1)
        assert.isNotNull(a1.projects)
        assert.ok( _.contains(a1.projects,tmp.p2.id) )

        done()
      })
    })
  })

  test('user_projects_of_kind', function(done){
    si.act('role: project, cmd: user_projects', {user:tmp.u1.id, kind:'foo'}, function(err, out){
      assert.isNull(err)
      assert.isNotNull(out)
      assert.isNotNull(out.project)

      assert.ok(1==out.projects.length)
      assert.equal( out.projects[0].name, tmp.p2.name )
      assert.equal( out.projects[0].kind, tmp.p2.kind )
      assert.equal( out.projects[0].kind, 'foo' )
      done()
    })
  })
})



