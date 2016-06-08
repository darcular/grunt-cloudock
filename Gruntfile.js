/*
 * grunt-cloudock
 * https://github.com/darcular/grunt-cloudock
 *
 * Copyright (c) 2016 Yikai Gong
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {

    grunt.sensitiveConfig = grunt.file.readJSON("sensitive.json");

    // Project configuration.
    grunt.initConfig({

        cloudock : {
            // PkgCloud client configuration
            pkgcloud : grunt.sensitiveConfig.pkgcloud,

            // Docker client configuratio
            docker : grunt.sensitiveConfig.docker,

            // Name of cluster to build (server names are composed as <cluster
            // name>-<node type increment number>-<node type>, i.e.:
            // "oa-1-computing")
            cluster : "darcular",

            // Security groups as defined by PkgCloud
            securitygroups : {
                http : {
                    description : "Open two HTTP ports to the load-balancer, computing, and dev machines",
                    rules : [ {
                        direction : "ingress",
                        ethertype : "IPv4",
                        protocol : "tcp",
                        portRangeMin : 80,
                        portRangeMax : 81,
                        remoteIpPrefix : "0.0.0.0/0",
                        remoteIpNodePrefixes : [ "loadbalancer", "computing" ]
                    } ]
                },
                default: {
                    description : "Open ssh port to public",
                    rules : [ {
                        direction : "ingress",
                        ethertype : "IPv4",
                        protocol : "tcp",
                        portRangeMin : 22,
                        portRangeMax : 22,
                        remoteIpPrefix : "0.0.0.0/0",
                        remoteIpNodePrefixes : [ "loadbalancer", "computing" ]
                    } ]
                }
            },

            // Types of node to provision (the images property contains the images
            // that are to be deployed on each node type. Replication is the
            // number of node of the same type to provision
            nodetypes : [
                {
                    name : "computing",
                    replication : 2,
                    imageRef : "81f6b78f-6d51-4de9-a464-91d47543d4ba",
                    flavorRef : "885227de-b7ee-42af-a209-2f1ff59bc330",
                    securitygroups : [ "default", "http" ],
                    images : [ "apache" ]
                } ]
        }


        // TODO Build unit test using grunt-contrib-nodeunit
        // nodeunit: {
        //   tests: ['test/*_test.js']
        // }

    });

    // Actually load this plugin's task(s).
    grunt.loadTasks('./tasks');

    // plugin's task(s), then test the result.
    grunt.registerTask('test', function () {
        console.log("Test missing");
    });

    grunt.registerTask("launch", 'Initiate cluster infrastructure', [
        "cloudock:secgroup:create",
        "cloudock:node:create",
        "cloudock:secgroup:update",
        "cloudock:node:dns"
    ]);

    grunt.registerTask("destroy", 'Destroy cluster infrastructure', [
        "cloudock:node:destroy",
        "cloudock:secgroup:destroy"
    ])
};
