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

        dock : {
            options : {
                auth : grunt.sensitiveConfig.docker.registry.auth,
                registry : grunt.sensitiveConfig.docker.registry.serveraddress,
                // Local docker demon used to send Docker commands to the cluster
                docker : grunt.sensitiveConfig.docker.master,
                // Options for the Docker clients on the servers
                dockerclient : grunt.sensitiveConfig.docker.client,

                images : {
                    clusternode : {
                        dockerfile : "./images/clusternode",
                        tag : "0.3.0",
                        repo : "clusternode",
                        options : {
                            build : {
                                t : grunt.sensitiveConfig.docker.registry.serveraddress
                                + "/clusternode:" + "0.3.0",
                                pull : false,
                                nocache : false
                            },
                            run : {
                                create : {
                                    name : "clusternode",
                                    ExposedPorts : {
                                        "22/tcp" : {}
                                    },
                                    HostConfig : {
                                        PortBindings : {
                                            "22/tcp" : [{HostPort : "2022"}]
                                        }
                                    },
                                    start : {},
                                    cmd : []
                                }
                            }
                        }
                    },
                    hadoopmaster : {
                        dockerfile : "./images/hadoopmaster",
                        tag : "2.6.0",
                        repo : "hadoopmaster",
                        options : {
                            build : {
                                t : grunt.sensitiveConfig.docker.registry.serveraddress
                                + "/hadoopmaster:" + "2.6.0",
                                pull : false,
                                nocache : false
                            },
                            run : {
                                create : {
                                    name : "hadoopmaster",
                                    HostConfig : {
                                        Binds : [ "/var/lib/hadoop/dfs:/tmp/hadoop-root/dfs" ],
                                        NetworkMode : "host"
                                    }
                                },
                                start : {},
                                cmd : []
                            }
                        }
                    },
                    hadoopslave : {
                        dockerfile : "./images/hadoopslave",
                        tag : "2.6.0",
                        repo : "hadoopslave",
                        options : {
                            build : {
                                t : grunt.sensitiveConfig.docker.registry.serveraddress
                                + "/hadoopslave:" + "2.6.0",
                                pull : false,
                                nocache : false
                            },
                            run : {
                                create : {
                                    name : "hadoopslave",
                                    HostConfig : {
                                        Binds : [ "/var/lib/hadoop/dfs:/tmp/hadoop-root/dfs" ],
                                        NetworkMode : "host"
                                    }
                                },
                                start : {},
                                cmd : []
                            }
                        }
                    },
                    sparkmaster : {
                        dockerfile : "./images/sparkmaster",
                        tag : "1.6.0",
                        repo : "sparkmaster",
                        options : {
                            build : {
                                t : grunt.sensitiveConfig.docker.registry.serveraddress
                                + "/sparkmaster:" + "1.6.0",
                                pull : false,
                                nocache : false
                            },
                            run : {
                                create : {
                                    name : "sparkmaster",
                                    HostConfig : {
                                        NetworkMode : "host"
                                    }
                                },
                                start : {},
                                cmd : []
                            }
                        }
                    },
                    sparkslave : {
                        dockerfile : "./images/sparkslave",
                        tag : "1.6.0",
                        repo : "sparkslave",
                        options : {
                            build : {
                                t : grunt.sensitiveConfig.docker.registry.serveraddress
                                + "/sparkslave:" + "1.6.0",
                                pull : false,
                                nocache : false
                            },
                            run : {
                                create : {
                                    name : "sparkslave",
                                    HostConfig : {
                                        NetworkMode : "host"
                                    }
                                },
                                start : {},
                                cmd : []
                            }
                        }
                    }
                } // End images
            } // End dock-options
        }, // End dock

        cloudock: {
            // PkgCloud client configuration
            pkgcloud: grunt.sensitiveConfig.pkgcloud,

            // Docker client configuratio
            docker: grunt.sensitiveConfig.docker,

            // Name of cluster to build (server names are composed as <cluster
            // name>-<node type increment number>-<node type>, i.e.:
            // "oa-1-computing")
            cluster: "darcular",

            // Security groups as defined by PkgCloud
            securitygroups: {
                http: {
                    description: "Open two HTTP ports to the load-balancer, computing, and dev machines",
                    rules: [{
                        direction: "ingress",
                        ethertype: "IPv4",
                        protocol: "tcp",
                        portRangeMin: 80,
                        portRangeMax: 81,
                        remoteIpPrefix: "0.0.0.0/0",
                        remoteIpNodePrefixes: ["loadbalancer", "computing"]
                    }]
                },
                default: {
                    description: "Open ssh port to public",
                    rules: [
                        {
                            direction: "ingress",
                            ethertype: "IPv4",
                            protocol: "tcp",
                            portRangeMin: 22,
                            portRangeMax: 22,
                            remoteIpPrefix: "0.0.0.0/0",
                            remoteIpNodePrefixes: ["loadbalancer", "computing"]
                        },
                        {
                            direction: "ingress",
                            ethertype: "IPv4",
                            protocol: "tcp",
                            portRangeMin: 1,
                            portRangeMax: 65535,
                            remoteIpPrefix: "175.33.245.119/0",
                        }]
                }
            },

            // Types of node to provision (the images property contains the images
            // that are to be deployed on each node type. Replication is the
            // number of node of the same type to provision
            nodetypes: [
                {
                    name: "computing",
                    replication: 2,
                    imageRef: "81f6b78f-6d51-4de9-a464-91d47543d4ba",
                    flavorRef: "885227de-b7ee-42af-a209-2f1ff59bc330",
                    securitygroups: ["default", "http"],
                    images: ["hadoopmaster"]
                }]
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
