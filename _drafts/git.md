---
title: "git常用操作"
categories:
  - Effective Java
toc: true
toc_label: "目录"
toc_icon: "heart"
---


- 删除本地tag  
  git tag -d <tag_name>

- 删除远程tag  
  git push origin :refs/tags/<tag_name>

- 本地分支push到远程新分支
  git push origin <local>:<master>
