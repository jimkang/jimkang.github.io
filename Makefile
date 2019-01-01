include config.mk

HOMEDIR = $(shell pwd)

pushall: sync
	git push origin master

prettier:
	prettier --single-quote --write "**/*.js"

sync:
	rsync -a $(HOMEDIR)/ $(USER)@$(SERVER):/$(DOMAINDIR) --exclude node_modules/ \
		--omit-dir-times --no-perms

