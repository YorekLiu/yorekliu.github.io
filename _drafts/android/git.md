---
title: "git常用操作"
categories:
  - Android
tags:
  - git
---

- 删除本地tag  
  git tag -d <tag_name>

- 删除远程tag  
  git push origin :refs/tags/<tag_name>

- 本地分支push到远程新分支
  git push origin <local>:<master>

- 删除远程分支  
  git branch -r -d origin/branch-name
  git push origin :branch-name