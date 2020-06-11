#!/bin/bash
        
baidu_verify=baidu_verify_Uu1IfDiteb.html

doCommit() {
    git checkout mkdocs

    rm -rf site

    mkdocs build

    echo ">>>>>>> copying CNAME & README.md"
    
    cp README.md site/
    cp CNAME site/
    cp $baidu_verify site/

    echo ">>>>>>> build in mkdocs branch success"

    chmod +x push2baidu.sh
    ./push2baidu.sh

    git checkout master

    rm -rf docs/ mkdocs.yml serve.sh push2baidu.sh

    echo ">>>>>>> copy site to root .."
    cp -a site/* .
    echo ">>>>>>> copy site to root success"

    git add .

    echo ">>>>>>> ready commit in master"
    echo ">>>>>>> exec git status ."

    git status .

    echo ">>>>>>> exec commit"
    git commit -m 'deploy from mkdocs'

    git push 

    git checkout mkdocs

    rm -rf site/
}

read -r -p "Are you sure to deploy? [Y/N] " input

case $input in
    [Yy][Ee][Ss]|[Yy])
        doCommit
        ;;
    
    [Nn][Oo]|[Nn])
        ;;
        
    *)
        ;;
esac
