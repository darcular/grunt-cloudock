# This project is a tweaked version of https://github.com/lmoran/grunt-clouddity

# grunt-cloudock

### Overview
A Grunt plugin to manage dockers on clusters using dockerode and pkgcloud.

### Usage:

All sensitive data (credentials) should be set in sensitive.json (see the example).
All nodes, images and security groups settings are in Gruntfile.js.

#### Manage cluster VMs:
$ grunt clouddock:node: [ create | list | destroy | dns]

 - Create the nodes (VMs) defined in Gruntfile.js
 - List cluster nodes specified by Gruntfile.js settings
 - Destroy cluster nodes
 - Build cluster's dns by adding their hostname-ip pairs into each /etc/hosts file

#### Manage cluster security groups:
$ grunt cloudock:secgroup:[ create | list | update | destroy ]

 - Create empyt security group defineds in Gruntfile.js
 - List cluster security groups
 - Addding the rules into security groups using existing nodes' real ip. (To be executed after nodes creation)
 - Destroy cluster security nodes

#### Manage docker engine on cluster nodes:
$ grunt cloudock:docker:[ pull | run | ps | rm | images | start | stop | rmi ]

 - Pull specified images from docker registry (defined in sensitive.json)
 - Run each image on every node
 - List containers on every node
 - Remove containers on every node
 - List images on every node
 - Start all stopped containers on every node
 - Stop all running containers on every node 
 - Remove all images on every node

### Common task flow:
 1. Create security groups
 2. Create nodes
 3. Update security groups (adding rules)
 4. Update /etc/hosts on each node (build dns)
 5. Pull images into every node
 6. Run images

### Todo List:
 - cloudock:localimg:[ build | push ]  - - - Build app images locally and push to private registry
 - cloudock:registry:rm  - - - Remove image from private registry
 - cloudock:volume - - - Manage volumes for clusters
