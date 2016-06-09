/**
 * @author Yikai Gong
 */
var _ = require('underscore'), async = require("async");
var exec = require('child_process').exec, pkgcloud = require("pkgcloud");
var logUpdate = require('log-update');
var utils = require("../../utils/utils");

var node = {};

node.create = function (grunt, options, gruntDone) {
    grunt.log.ok("Started creating node...");
    var client = pkgcloud.compute.createClient(options.pkgcloud.client);
    var nodes = {};
    var tableUpdater = setInterval(function () {
        logUpdate(composeNodesTable(_.toArray(nodes)));
    }, 1000);
    var iterator = function (node, iterationDone) {
        var serverConfig = {
            tenantId: options.pkgcloud.client.tenantName,
            security_groups: utils.composeClusterSecGrpNameList(options.cluster, node.securitygroups),
            user_data: options.pkgcloud.user_data,
            availability_zone: options.pkgcloud.availability_zone,
            imageRef: node.imageRef,
            flavorRef: node.flavorRef,
            name: node.name,
            key_name: options.pkgcloud.key_name
        };
        client.createServer(serverConfig, function (err, result) {
            if (err)
                return utils.handleErr(err, iterationDone, false);
            var updateTuple = function () {
                utils.queryNode(options, result.id, function (err, node) {
                    if(err){
                        return utils.handleErr(err, iterationDone, true);
                    }
                    var nodeTuple = [];
                    var hostId = node.id.substr(0, 5) + "..";
                    var hostName = node.name;
                    var hostAddress = node.address;
                    var hostStatus = node.status.toUpperCase();
                    nodeTuple.push(hostId, hostName, hostAddress, changeStatusColor(hostStatus));
                    nodes[hostId] = nodeTuple;
                    if (hostStatus == "RUNNING") {
                        clearInterval(tupleUpdater);
                        clearTimeout(timeout);
                        return iterationDone();
                    }
                });
            };
            updateTuple();
            var tupleUpdater = setInterval(updateTuple, 3000);
            var timeout = setTimeout(function () {
                if (tupleUpdater._repeat) {
                    clearInterval(tupleUpdater);
                    return iterationDone();
                }
            }, 240000);
        });
    };
    var iteratorStopped = function (err) {
        clearInterval(tableUpdater);
        logUpdate(composeNodesTable(_.toArray(nodes)));
        logUpdate.done();
        if (err)
            return utils.handleErr(err, gruntDone, false);
        grunt.log.ok("Done creating nodes.");
        return gruntDone();
    };
    async.each(utils.getDefinedNodes(options), iterator, iteratorStopped);
};
node.create.description = "Create node VMs of cluster";

/**
 * List all the nodes in the cluster
 *
 * @param {Object} grunt
 *          grunt The Grunt instance
 * @param {Object} options
 *          options The task parameters
 * @param {Function} gruntDone
 *          done Callback to call when the requests are completed
 */
node.list = function (grunt, options, gruntDone) {
    var nodeTupleList = [];
    var iterator = function (node, iterationDone) {
        var nodeTuple = [];
        var hostId = node.id.substr(0, 5) + "..";
        var hostName = node.name;
        var hostAddress = node.address;
        var hostStatus = node.status.toUpperCase();
        nodeTuple.push(hostId, hostName, hostAddress, changeStatusColor(hostStatus));
        nodeTupleList.push(nodeTuple);
        return iterationDone();
    };
    var iteratorStopped = function (err) {
        if (err)
            return utils.handleErr(err, gruntDone, false);
        console.log(composeNodesTable(nodeTupleList));
        return gruntDone();
    };
    utils.iterateOverClusterNodes(options, "", iterator, iteratorStopped, true);
};
node.list.description = "List nodes of cluster";

/**
 * Deletes the VMs that are defined in options.serverstypes. The servers to be
 * deleted are found by their names (a compistion of servertypes.name, an hypen,
 * and a progressive number.
 *
 * @param {Object} grunt
 *          grunt The Grunt instance
 * @param {Object} options
 *          options Task options
 * @param {Function} gruntDone
 *          done Callback to call when the request is completed
 */
node.destroy = function (grunt, options, gruntDone) {
    async.waterfall([
        // First: Get user confirm
        function (next) {
            promptBeforeDestroy(function (comfirmed) {
                return next(null, comfirmed);
            });
        },
        // Second: delete nodes based on user's confirm
        function (confirm, next) {
            if (!confirm) {
                return next(new Error("User Aborted"));
            }
            grunt.log.ok("Started deleting nodes...");
            var iterator = function (node, iterationDone) {
                var client = pkgcloud.compute.createClient(options.pkgcloud.client);
                client.destroyServer(node.id, function (err, result) {
                    if (err)
                        return utils.handleErr(err, iterationDone, true);
                    //TODO check until nodes is removed
                    var checkDelection = function(){
                        utils.queryNode(options, node.id, function (err, node) {
                            if(err && err.statusCode == 404){
                                grunt.log.ok("Deleted node: " + result.ok);
                                clearInterval(checkDelection);
                                clearTimeout(timeout);
                                return iterationDone();
                            }
                        });
                    };
                    var deletionChecker = setInterval(checkDelection, 3000);
                    var timeout = setTimeout(function(){
                        if(tupleUpdater._repeat){
                            clearInterval(deletionChecker);
                            return iterationDone(new Error("Deletion Time out"));
                        }
                    },240000)
                });
            };
            var iteratorStopped = function (err) {
                return next(err);
            };
            utils.iterateOverClusterNodes(options, null, iterator, iteratorStopped, false);
        }
    ], function (err) {
        if (err)
            return utils.handleErr(err, gruntDone, false);
        grunt.log.ok("Done deleting nodes.");
        return gruntDone();
    })
};
node.destroy.description = "Destroy node VMs of cluster";

/**
 * Add all hosts in the cluster to the /etc/hosts of every ACTIVE node
 *
 * @param {Object} grunt
 *          grunt The Grunt instance
 * @param {Object} options
 *          options The task parameters
 * @param {Function} gruntDone
 *          done Callback to call when the requests are completed
 */
node.dns = function (grunt, options, gruntDone) {
    // Check configuration file
    try {
        var username = options.pkgcloud.client.sshusername;
    } catch (err) {
        grunt.fail.warn("user name for ssh has not been defined");
        return gruntDone(err);
    }
    grunt.log.ok("Started updating /etc/hosts file on each ACTIVE node ...");
    // Serial Asynchronous works start
    async.waterfall([
        // Get cluster nodes's ip-name pair
        function (next) {
            var hosts = [];
            var iterator = function (node, iterationDone) {
                hosts.push(node.ipv4 + " " + node.name);
                return iterationDone();
            };
            var iteratorStopped = function (err) {
                return err ? utils.handleErr(err, next, false) : next(null, hosts);
            };
            utils.iterateOverClusterNodes(options, "", iterator, iteratorStopped, true);
        },
        // Edit hosts file on each ALIVE node
        function (hosts, next) {
            var iterator = function (node, iterationDone) {
                var contentToAppend = hosts.join("\n") + "\n";
                var cmdStr = "'sudo echo \"" + contentToAppend + "\" | cat - /etc/hosts > temp && sudo mv temp /etc/hosts'";
                sshExec(username, node.ipv4, cmdStr, function (err) {
                    utils.handleErr(err, iterationDone, true);
                    grunt.log.ok("Done appending hosts to " + node.name);
                    return iterationDone();
                });
            };
            var iteratorStopped = function (err) {
                return err ? utils.handleErr(err, next, false) : next(null);
            };
            utils.iterateOverClusterNodes(options, "active", iterator, iteratorStopped, false)
        }
    ], function (err) {
        return err ? utils.handleErr(err, gruntDone, false) : gruntDone();
    });
};

module.exports.node = node;

function composeNodesTable(nodeTupleList) {
    var Table = require('cli-table');
    var table = new Table({
        head: ['Id'.cyan, 'Name'.cyan, 'Zone:Ipv4'.cyan, 'Status'.cyan],
        colWidths: [],
        style: {compact: true, 'padding-left': 0, 'padding-right': 0},
        chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗'
            , 'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝'
            , 'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼'
            , 'right': '║', 'right-mid': '╢', 'middle': '│'
        }
    });
    table.push.apply(table, nodeTupleList);
    return table.toString();
}

function changeStatusColor(hostStatus) {
    switch (hostStatus) {
        case 'RUNNING':
            hostStatus = hostStatus.green;
            break;
        case 'PROVISIONING':
        case 'UPDATING':
        case 'REBOOT':
            hostStatus = hostStatus.yellow;
            break;
        default:
            hostStatus = hostStatus.red;
            break;

    }
    return hostStatus;
}

function promptBeforeDestroy(callback) {
    var rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question("Going to destroy all cluster nodes. Are you sure? (y/N)", function (answer) {
        if (!(answer.toUpperCase() == "Y" || answer.toUpperCase() == "YES")) {
            return callback(false);
        } else {
            return callback(true);
        }
    })
}

function sshExec(username, address, cmd, callback) {
    exec(["ssh", '-o "StrictHostKeyChecking no"', username + "@" + address, "-C"].concat(cmd).join(" "), callback);
}