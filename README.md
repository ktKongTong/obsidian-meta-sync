# Obsidian Meta Sync Plugin

This is an obsidian plugin to sync content metadata to postgres.

syncing content include:
- a generated id written in frontmatter.
- most Frontmatter like id, title, excerpt, tags, date
- relativePath to the root
- `folder` or `file` field // maybe file-resource


## use case
1. sync content metadata to db.
2. use remote-save like plugins to sync content to cloud storeage. like s3 or r2.
3. now you can use it to create abd serve a publish like custom service.
