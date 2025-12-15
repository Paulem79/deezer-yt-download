#!/bin/bash

read -p "Enter version tag (e.g., v1.0.0): " TAG

if [ -z "$TAG" ]; then
    echo "Error: No tag provided"
    exit 1
fi

echo "Creating tag $TAG..."
git tag "$TAG"

echo "Pushing tag $TAG to origin..."
git push origin "$TAG"

echo "Done! Tag $TAG has been pushed."
