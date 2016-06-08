/**
 * @author Yikai Gong
 */

"use strict";

var pkgcloud = require("pkgcloud"), _ = require("underscore"), async = require("async");
var _ = require("underscore");

/**
 * Logs an error (if existing) on the Grunt error log, and calls the callback with or
 * without the err as arguments(e.g. continue an iterator when error appears in one
 * iteration)
 *
 * @param err {object}
 * @param done {function}
 * @param breakIterator {boolean}
 * @returns {*}
 */
module.exports.handleErr = function (err, done, ignoreErr) {
    if (err) {
        require("grunt").log.error(err.message + " " + JSON.stringify(err.result));
        if (ignoreErr) {
            return done();
        } else {
            return done(err);
        }
    }
};

module.exports.logErrMsg = function (err) {
    require("grunt").log.error(err.message + " " + JSON.stringify(err.result));
};

/**
 * Security Group Utils
 */
/**
 * Serial iterate over the active security groups in the cluster that
 * satisfy a filtering condition (it can be used to select only the security
 * groups in a given cluster)
 *
 * @param options {Object}
 *          options Task options
 * @param selector {Function}
 *          selector Function to select security groups to iterate over (it is
 *          passed the security group data and must return true if the group is
 *          to be selected)
 * @param iterator {Function}
 *          iterator The function is passed an Object containing the security
 *          group parameters, and a callback function to call when one iteration
 *          is complete (the callback is, if in error, sent an error object)
 * @param done {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 */
module.exports.iterateOverSecurityGroups = function (options, selector, iterator, done) {
    // Retrieves the active security groups
    var pkgcloudClient = pkgcloud.network.createClient(options.pkgcloud.client);
    var callback = function (err, activeGroups) {
        if (err) {
            module.exports.logErrMsg(err);
            return done(err);
        }
        async.eachSeries(_.filter(activeGroups, selector), iterator, done);
    };
    pkgcloudClient.getSecurityGroups(null, callback);
};

/**
 * Serial iterate over the SECURITY GROUPS belonging to the cluster (as
 * defined in the options)
 *
 * @param options {Object}
 *          options Task options
 * @param iterator {Function}
 *          iterator The function is passed an Object containing the security
 *          group parameters, and a callback function to call when one iteration
 *          is complete (the callback is, if in error, sent an error object)
 * @param done {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 *
 */
module.exports.iterateOverClusterSecurityGroups = function (options, iterator, done) {
    var selector = function (sec) {
        return module.exports.securitygroupCluster(sec.name) === options.cluster
    };
    module.exports.iterateOverSecurityGroups(options, selector, iterator, done);
};

/**
 * Returns the name of security group given some parameters
 *
 * @param clusterName {String}
 *          clusterName Name of cluster the security group belongs to (must not
 *          contain dashes)
 * @param securityGroupName {String}
 *          securityGroupName Name of security group (must not contain dashes)
 *
 * @returns {String} Name of the secuirty group
 */
module.exports.securitygroupName = function (clusterName, securityGroupName) {
    return clusterName + "-" + securityGroupName;
};

/**
 * Returns the cluster name of a security group given its name
 *
 * @param secName {String}
 *          secName Name of security groups
 *
 * @returns {String} Name of cluster
 */
module.exports.securitygroupCluster = function (secName) {
    return secName.split("-")[0];
};

/**
 * Returns security groups in the format favored from OpenStack.
 *
 * @param clusterName {String}
 *          clusterName Name of cluster the security group belongs to (must not
 *          contain dashes)
 * @param secGroups {Array}
 *          secGroups Array of security group names
 * @return {Array} Array of Objects with name property only (like:
 *         "[{\"name\":\"secgroup1\"}, {\"name\":\"secgroup2\"}]")
 */
module.exports.composeClusterSecGrpNameList = function (clusterName, secGroups) {
    return _.map(secGroups, function (grp) {
        return {name: module.exports.securitygroupName(clusterName, grp)};
    });
};
/**
 * Node Utils
 */
/**
 * Returns a list of servers based on the node types defined in options
 *
 * @param options {Object}
 *          option Task Grunt options
 * @return {Array} Array of Objects containing all server definitions with
 *         replication (name is changed to the actual server one)
 */
module.exports.getDefinedNodes = function (options) {
    var nodes = [];
    var nodeTypes = options.nodetypes;
    nodeTypes.forEach(function (nodeType) {
        for (var i = 1; i <= nodeType.replication; i++) {
            var node = JSON.parse(JSON.stringify(nodeType));
            node.type = nodeType.name;
            node.name = module.exports.nodeName(options.cluster, node.type, i);
            nodes.push(node);
        }
    });
    return nodes;
};

/**
 * Iterate over the the servers active in the cloud that satisfy the cluster's name
 *
 * @param options {Object}
 *          Client credential of cloud user
 * @param status {String}
 *          Status of the node to be requested
 * @param iterator {Function}
 *          iterator The function is passed an Object containing the iterator
 *          parameters, and a callback function to call when one iteration is
 *          complete (the callback is, if in error, sent an error object)
 * @param done {Function}
 *          done Callback to call when the requests are completed (an err
 *          parameter is passed if an error occurred)
 * @param serial {Boolean}
 *          If using serial iteration
 */
module.exports.iterateOverClusterNodes = function (options, status, iterator, done, serial) {
    var client = pkgcloud.compute.createClient(options.pkgcloud.client);
    // Retrieves the active nodes IP addresses
    var queryOpt = {name: options.cluster};
    if (status && status !== "") {
        //noinspection JSValidateTypes
        queryOpt.status = status;
    }
    client.getServers(queryOpt, function (err, nodes) {
        module.exports.handleErr(err, done, false);
        // Extracts some data about the selected nodes and puts them back intonodes
        module.exports.preProcessNodeData.bind(options);
        nodes = _.map(nodes, module.exports.preProcessNodeData.bind(options));
        // Calls the iterator for all the elements in data
        if (serial) {
            async.eachSeries(nodes, iterator, done);
        } else {
            async.each(nodes, iterator, done);
        }
    });
};

/**
 * Send a request to cloud provider for getting the status of a server
 *
 * @param options {Object} plugin configurations
 * @param serverId {String} Server Id of the requested VM
 * @param callback {Function} callback to fire after getting server's detail
 */
module.exports.queryNode = function (options, serverId, callback) {
    var client = pkgcloud.compute.createClient(options.pkgcloud.client);
    client.getServer(serverId, function (err, node) {
        if (!err) {
            node = exports.preProcessNodeData.call(options, node);
            callback(node);
        }
    });
}

/**
 * Returns the name of node given some parameters
 *
 * @param {String}
 *          clusterName Name of cluster the node belongs to (must not contain
 *          dashes)
 * @param {String}
 *          nodeType Type of node (must not contain dashes)
 * @param {Number}
 *          seq Sequential number of node
 *
 * @returns {String} Name of the node
 */
module.exports.nodeName = function (clusterName, nodeType, seq) {
    return clusterName + "-" + nodeType + "-" + seq;
};

/**
 * Returns the type of a node given its name
 *
 * @param {String}
 *          nodeName Name of node
 *
 * @returns {String} Type of node
 */
module.exports.nodeType = function (nodeName) {
    return nodeName.split("-")[1];
};

module.exports.preProcessNodeData = function (node) {
    var _node = {}
    _node.id = node.id ? node.id : "";
    _node.name = node.name ? node.name : "";
    _node.address = _.keys(node.addresses).length > 0 ? _.keys(node.original.addresses)[0] + ":" + node.addresses.public[0] : "";
    _node.ipv4 = _.keys(node.addresses).length > 0 ? node.addresses.public[0] :"";
    _node.type = node.name ? module.exports.nodeType(node.name) : "";
    _node.status = node.status ? node.status : "";
    var filteredNodeOptions = _.filter(this.nodetypes, function (nodetype) {
        return nodetype.name === node.name ? module.exports.nodeType(_node.name) : "";
    });
    var nodeOption = filteredNodeOptions.length > 0 ? filteredNodeOptions[0] : undefined;
    if (nodeOption) {
        _node.nodeOption = nodeOption;
        _node.docker = {
            protocol: this.docker.client.protocol,
            host: node.ipv4,
            port: this.docker.client.port,
            auth: this.docker.client.auth
        }
    }
    return _node;
}
