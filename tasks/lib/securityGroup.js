/**
 * @author Yikai Gong
 */

"use strict";

var pkgcloud = require("pkgcloud"), async = require("async");
var _ = require("underscore");
var utils = require("../../utils/utils");

var secgroup = {};

secgroup.create = function (grunt, options, done) {
    grunt.log.ok("Started creating security groups...");
    // Iterates over the security groups in options and adds them
    var createdGroups = [];
    var pkgcloudClient = pkgcloud.network.createClient(options.pkgcloud.client);
    var groupNameList = _.keys(options.securitygroups);
    var iterator = function (grpName, iterationDone) {
        var groupInfo = {};
        groupInfo.name = utils.securitygroupName(options.cluster, grpName);
        groupInfo.description = options.securitygroups[grpName].description;
        pkgcloudClient.createSecurityGroup(groupInfo, function (err, result) {
            utils.handleErr(err, iterationDone, true);
            createdGroups.push({id: result.id, name: grpName});
            grunt.log.ok("Created security group: "
                + utils.securitygroupName(options.cluster, grpName) + " "
                + result.id);
            return iterationDone();
        });
    };
    var callback = function (err) {
        grunt.log.ok("Done creating security groups.");
        done(err);
    };
    async.each(groupNameList, iterator, callback);
};
secgroup.create.description = "Create security groups for cluster";

secgroup.destroy = function (grunt, options, done) {
    grunt.log.ok("Started deleting security groups...");
    var iterator = function (grp, iterationDone) {
        var pkgcloudClient = pkgcloud.network.createClient(options.pkgcloud.client);
        pkgcloudClient.destroySecurityGroup(grp.id, function (err, grpId) {
            utils.handleErr(err, done);
            grunt.log.ok("Deleted security group: " + grp.name + " " + grpId + " ");
            return iterationDone(err);
        });
    };
    var callback = function (err) {
        grunt.log.ok("Done deleting security groups.");
        if (err) {
            return done(err);
        }
        done();
    };
    utils.iterateOverClusterSecurityGroups(options, iterator, callback);
};
secgroup.destroy.description = "Delete security groups for cluster";

secgroup.list = function (grunt, options, done) {
    // grunt.log.ok("name,id,rules...");
    var secGrpTuples = [];
    var iterator = function (grp, iterationDone) {
        if (grp.description.length > 40)
            grp.description = grp.description.substr(0, 40) + "...";
        secGrpTuples.push([grp.id, grp.name, grp.description]);
        return iterationDone();
    };
    var callback = function (err) {
        if (err) {
            return done(err);
        }
        drawSecGrpTable(secGrpTuples);
        done();
    };
    utils.iterateOverClusterSecurityGroups(options, iterator, callback);
};
secgroup.list.description = "List security groups for cluster";


secgroup.update = function (grunt, options, gruntDone) {
    grunt.log.ok("Started updating security groups...");

    async.waterfall([
        // Retrieves the nodes data and puts them in nodes
        function (next) {
            var nodes = [];
            var iterator = function (node, iterationDone) {
                nodes.push({
                    name: node.name,
                    id: node.id,
                    address: node.ipv4
                });
                return iterationDone();
            };
            var iteratorStopped = function (err) {
                utils.handleErr(err, next(err), false);
                return next(null, nodes);
            }
            utils.iterateOverClusterNodes(options, "", iterator, iteratorStopped, false);
        },
        // Updates security groups by adding the actual rules
        function (nodes, next) {
            var iterator = function (secgroup, iterationDone) {
                //TODO
                // Puts in selRules all the rules of the existing group
                // that have a remoteIpPrefixTemplate or a remoteIpPrefix
                // property defined
                // var rulesToAdd = [];
                // var selRules = _.filter(options.securitygroups[utils
                //     .securitygroupPlainName(grp.name)].rules, function (rule) {
                //     return rule.remoteIpNodePrefixes || rule.remoteIpPrefix;
                // });
                //
                // // Adds rules to rulesToAdd based on node IP addresses (if
                // // remoteIpNodePrefixes), and/or remoteIpPrefix
                // selRules.forEach(function (rule) {
                //
                //     if (rule.remoteIpNodePrefixes) {
                //         nodes
                //             .forEach(function (node) {
                //                 if (rule.remoteIpNodePrefixes
                //                         .indexOf(utils.nodeType(node.name)) >= 0) {
                //                     rulesToAdd.push({
                //                         securityGroupId: grp.id,
                //                         direction: rule.direction,
                //                         ethertype: rule.ethertype,
                //                         portRangeMin: rule.portRangeMin,
                //                         portRangeMax: rule.portRangeMax,
                //                         protocol: rule.protocol,
                //                         remoteIpPrefix: node.address
                //                     });
                //                 }
                //             });
                //     }
                //
                //     if (rule.remoteIpPrefix) {
                //         rulesToAdd.push({
                //             securityGroupId: grp.id,
                //             direction: rule.direction,
                //             ethertype: rule.ethertype,
                //             portRangeMin: rule.portRangeMin,
                //             portRangeMax: rule.portRangeMax,
                //             protocol: rule.protocol,
                //             remoteIpPrefix: rule.remoteIpPrefix
                //         });
                //     }
                // });
                //
                // // Iterates over rulesToAdd and adds them rules
                // async.each(rulesToAdd, function (rule, callback3) {
                //     pkgcloud.network.createClient(options.pkgcloud.client)
                //         .createSecurityGroupRule(rule, function (err, result) {
                //             utils.dealWithError(err, gruntDone);
                //             return callback3();
                //         }, function (err) {
                //             utils.dealWithError(err, gruntDone);
                //             grunt.log.ok("Updated security group: " + grp.id);
                //         });
                // }, function (err) {
                //     utils.dealWithError(err, gruntDone);
                //     grunt.log.ok("Updated security group: " + grp.id);
                //     return callback2();
                // });
            };
            var iteratorStopped = function (err) {
                utils.handleErr(err, next, false);
                return next();
            }
            utils.iterateOverClusterSecurityGroups(options, iterator, iteratorStopped);
        }
    ], function (err) {
        utils.handleErr(err, gruntDone, false);
        return gruntDone();
    });
}

module.exports.secgroup = secgroup;

function drawSecGrpTable(data) {
    var Table = require('cli-table');
    var table = new Table({
        head: ['Id'.cyan, 'Name'.cyan, 'Description'.cyan],
        colWidths: [],
        style: {compact: true, 'padding-left': 0, 'padding-right': 0},
        chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗'
            , 'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝'
            , 'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼'
            , 'right': '║', 'right-mid': '╢', 'middle': '│'
        }
    });
    table.push.apply(table, data);
    console.log(table.toString());
}