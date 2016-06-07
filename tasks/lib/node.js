/**
 * @author Yikai Gong
 */
var pkgcloud = require("pkgcloud"), async = require("async");
var utils = require("../../utils/utils");
var logUpdate = require('log-update');
var _ = require('underscore');

var node = function (grunt, options, done) {
    grunt.fail.warn("Commands for manage node. Use --help to find out usage.");
};

node.create = function (grunt, options, done) {
    grunt.log.ok("Started creating node...");
    var client = pkgcloud.compute.createClient(options.pkgcloud.client);
    var nodes = {};
    var tableUpdate = setInterval(function () {
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
            utils.handleErr(err, iterationDone, true);
            var tupleUpdate = setInterval(function () {
                utils.queryNode(options, result.id, function (node) {
                    var nodeTuple = [];
                    var hostId = node.id ? node.id : "";
                    var hostName = node.name ? node.name : "";
                    var hostAddress = _.keys(node.addresses).length > 0 ? _.keys(node.original.addresses)[0] + ":" + node.addresses.public[0] : "";
                    var hostStatus = node.status ? node.status.toUpperCase() : "";
                    nodeTuple.push(hostId, hostName, hostAddress, changeStatusColor(hostStatus));
                    nodes[hostId] = nodeTuple;
                    if (hostStatus == "RUNNING") {
                        clearInterval(tupleUpdate);
                        return iterationDone();
                    }
                })
            }, 3000);
            setTimeout(function () {
                if(tupleUpdate._repeat){
                    clearInterval(tupleUpdate);
                    iterationDone();
                }
            }, 60000);
        });
    };
    var iteratorStopped = function (err) {
        clearInterval(tableUpdate);
        logUpdate(composeNodesTable(_.toArray(nodes)));
        logUpdate.done();
        grunt.log.ok("Done creating node.");
        utils.handleErr(err, done, false);
        done();
    }
    async.each(utils.getDefinedNodes(options), iterator, iteratorStopped);
};
node.create.description = "Create node VMs of cluster";

/**
 * List all the nodes in the cluster
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options The task parameters
 * @param {Function}
 *          done Callback to call when the requests are completed
 */
node.list = function (grunt, options, done) {
    var nodeTupleList = [];
    var iterator = function (node, iterationDone) {
        nodeTuple = [];
        var hostId = node.host.id
        var hostName = node.host.name;
        var hostAddress = node.host.address;
        var hostStatus = node.host.status.toUpperCase();
        hostStatus = changeStatusColor(hostStatus);
        nodeTuple.push(hostId, hostName, hostAddress, hostStatus);
        nodeTupleList.push(nodeTuple);
        return iterationDone();
    };
    var iteratorStopped = function (err) {
        utils.handleErr(err, done, false);
        console.log(composeNodesTable(nodeTupleList));
        return done();
    }
    utils.iterateOverClusterNodes(options, undefined, iterator, iteratorStopped, true);
};
node.list.description = "List nodes of cluster";

/**
 * Deletes the VMs that are defined in options.serverstypes. The servers to be
 * deleted are found by their names (a compistion of servertypes.name, an hypen,
 * and a progressive number.
 *
 * @param {Object}
 *          grunt The Grunt instance
 * @param {Object}
 *          options Task options
 * @param {Function}
 *          done Callback to call when the request is completed
 */
node.destroy = function (grunt, options, done) {
    grunt.log.ok("Started deleting nodes...");
    var iterator = function (node, iterationDone) {
        var client = pkgcloud.compute.createClient(options.pkgcloud.client);
        client.destroyServer(node.host.id, function (err, result) {
            utils.handleErr(err, iterationDone, true);
            grunt.log.ok("Deleted node: " + result.ok);
            return iterationDone();
        });
    };
    var callback = function (err) {
        grunt.log.ok("Done deleting nodes.");
        if (err) {
            return done(err);
        }
        done();
    }
    utils.iterateOverClusterNodes(options, null, iterator, callback, false);
};
node.destroy.description = "Destroy node VMs of cluster";

module.exports.node = node;

function composeNodesTable(nodeTupleList) {
    var Table = require('cli-table');
    var table = new Table({
        head: ['Id'.cyan, 'Name'.cyan, 'Zone:Ipv4'.cyan, 'Status'.cyan],
        colWidths: [],
        style: {compact: true, 'padding-left': 1, 'padding-right': 1},
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