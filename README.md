# grunt-cloudock

### Overview
A Grunt plugin to manage dockers on clusters using dockerode and pkgcloud.

### Usage:
##### Manage cluster VMs:
grunt clouddock:node: [ create | list | destroy ]
##### Manage cluster security groups:
grunt cloudock:secgroup:[ create | list | update | destroy ]
### In developing ...

### Todo List:
 - cloudock:localimg:[ build | push ]  - - - Build app images locally and push to private registry
 - cloudock:img:[ pull | rm | run ]   - - - Manage docker image on cluster hosts
 - cloudock:container:[ start | stop | rm ] - - - Manage application container on cluster hosts
 - cloudock:registry:rm  - - - Remove image from private registry
