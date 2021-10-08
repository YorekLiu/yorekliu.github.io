#!/bin/bash
        
baidu_verify=baidu_verify_Uu1IfDiteb.html
url_txt=urls.txt

doCommit() {
    git checkout mkdocs

    rm -rf site

    mkdocs build

    echo ">>>>>>> copying CNAME & README.md"
    
    cp README.md site/
    cp CNAME site/
    cp $baidu_verify site/

    echo ">>>>>>> build in mkdocs branch success"

    echo "push2baidu executing ..."

    rm -f $url_txt

    cmd=`grep loc site/sitemap.xml  | awk -F ">" '{print $2}' | awk -F "<" '{print $1}'`

    for line in $cmd; do
        echo $line >> $url_txt
    done

    echo "pushing urls to baidu"

    curl -H 'Content-Type:text/plain' --data-binary "@$url_txt" "http://data.zz.baidu.com/urls?site=https://blog.yorek.xyz&token=XAt9QHfqMXWRRMoU"

    echo "push completed."

    git checkout master

    rm -rf docs/ mkdocs.yml serve.sh push2baidu.sh

    echo ">>>>>>> copy site to root .."
    cp -a site/* .
    echo ">>>>>>> copy site to root success"

    rm -f $url_txt
    rm -f 404.html
    git add .

    echo ">>>>>>> ready commit in master"
    # echo ">>>>>>> exec git status ."

    # git status .

    echo ">>>>>>> exec commit"
    git commit -m 'deploy from mkdocs'

    git push -f

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
