#!/bin/bash

branch_name=$(git symbolic-ref -q --short HEAD)

if [[ "$branch_name" != "master" ]]; then
        echo "Must be on master branch to push new version but you are on $branch_name"
  exit 1
fi
