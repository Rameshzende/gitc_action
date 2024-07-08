const core = require('@actions/core')
const exec = require('@actions/exec')
const github = require('@actions/github')


const setUpGit = async () => {
    await exec.exec(`git config --global user.name "gh-automation"`);
    await exec.exec(`git config --global user.email "gh-automation@email.com"`);
}

const validateBranchName = ({ branchName }) => (/^[a-zA-Z0-9_\-\.\/]+$/.test(branchName))
const validateDir = ({ dirName }) => (/^[a-zA-Z0-9_\-\/]+$/.test(dirName))

const setUpLogger = ({ debug, prefix } = { debug: false, prefix: '' }) => ({
    debug: (message) => {
        if (debug) {
            core.info(`DEBUG : ${prefix}${prefix ? '' : ''}${message}`)
        }
    },
    info: (message) => {
        core.info(`INFO: ${prefix}${prefix ? '' : ''}${message}`)
    },
    error: (message) => {
        core.error(`ERROR: ${prefix}${prefix ? '' : ''}${message}`)
    }
})



async function run() {
    const baseBranch = core.getInput('base-branch', { required: true });
    const headBranch = core.getInput('head-branch', { required: true });
    const ghToken = core.getInput('gh-token', { required: true });
    const workingDir = core.getInput('working-directory', { required: true });
    const debug = core.getBooleanInput('debug');
    const logger = setUpLogger({ debug, prefix: '[js-dependency-update]' });

    const commonExecOpts = {
        cwd: workingDir
    }

    core.setSecret(ghToken)

    logger.debug(`validating inputs: ${baseBranch}`)

    if (!validateBranchName({ branchName: baseBranch })) {
        core.setFailed('Invalid base branch name. branch name should include only alphabets, numbers, _, -, ., /')
        return
    }

    if (!validateBranchName({ branchName: headBranch })) {
        core.setFailed('Invalid head name. branch name should include only alphabets, numbers, _, -, ., /')
        return
    }

    if (!validateDir({ dirNAme: workingDir })) {
        core.setFailed('Invalid working directory. Directory name should include only alphabets, numbers, _, -')
        return
    }

    logger.debug(`Base Branch: ${baseBranch}`)
    logger.debug(`Head Branch: ${headBranch}`)
    logger.debug(`working directory: ${workingDir}`)

    logger.debug('checking for updates')

    await exec.exec('npm update', [], { ...commonExecOpts })

    const gitStatus = await exec.getExecOutput(
        'git status -s package*.json',
        [],
        {
            ...commonExecOpts,
        }
    )

    if (gitStatus.stdout.length > 0) {
        logger.debug('There are updated available')
        logger.debug('Setting up git')

        setUpGit()
  
        logger.debug('Committing and pushing package*.json changes');
        await exec.exec(`git checkout -b ${headBranch}`, [], {
            ...commonExecOpts,
        });
        await exec.exec(`git add package.json package-lock.json`, [], {
            ...commonExecOpts,
        });
        await exec.exec(`git commit -m "chore: update dependencies`, [], {
            ...commonExecOpts,
        });
        await exec.exec(`git push -u origin ${headBranch} --force`, [], {
            ...commonExecOpts,
        });

        logger.debug('fetching octokit instance and creating pull request')

        const octokit = github.getOctokit(ghToken);

        try {
            logger.debug(`Creating pull request using headBranch ${{ headBranch }}`)

            await octokit.pulls.create({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                title: `Update NPM dependencies`,
                body: `This pull request updates NPM packages`,
                base: baseBranch,
                head: headBranch,
            })
        } catch (error) {
            logger.error('Error while creating pull request')
            core.setFailed(error.message)
            logger.error(error)
            return
        }

    } else {
        logger.info('No changes detected in package*.json files')
    }
}

run()