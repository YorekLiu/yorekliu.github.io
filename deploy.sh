git checkout mkdocs

rm -rf site

mkdocs build

echo ">>>>>>> build in mkdocs branch success"

git checkout master

echo ">>>>>>> git branch"

git branch

rm -rf docs/ mkdocs.yml serve.sh

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
