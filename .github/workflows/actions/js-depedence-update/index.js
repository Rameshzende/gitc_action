const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const validateBranchName = ({ branchName }) => (/^[a-zA-Z0-9_\-\.\/]+$/.test(branchName))
const validateDir = ({ dirName }) => (/^[a-zA-Z0-9_\-\/]+$/.test(dirName))

const setUpLogger = ({ debug, prefix } = {debug: false, prefix: ''}) => ({
    debug: (message) => {
      if(debug) {
        core.info(`${prefix}${prefix ? '' : 'DEBUG: '}${message}`)
      }
    },
    info: (message) => {
        core.info(`${prefix}${prefix ? '' : 'INFO: '}${message}`)
    },
    error: (message) => {
      core.error(`${prefix}${prefix ? '' : 'ERROR: '}${message}`)
    }
})

  
const setUpGit = async () => {
    await exec.exec('git config --global user.email "gh-automation@email.com"')
    await exec.exec('git config --global user.name "gh-automation"')
}


async function run() {
    const baseBranch = core.getInput('base-branch', { required: true })
    const headBranch = core.getInput('head-branch', { required: true })
    const githubToken = core.getInput('gh-token', { required: true })
    const workingDir = core.getInput('working-directory', { required: true })
    const debug = core.getBooleanInput('debug')
    const logger = setUpLogger({ debug, prefix: '[js dependency update]' })
  

    const commonExecOpts = {
        cwd: workingDir
    }

    core.setSecret(githubToken)

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
    logger.debug(`head Branch: ${headBranch}`)
    logger.debug(`working directory: ${workingDir}`)

    logger.debug('checking for updates')

    await exec.exec('npm update', [], { ...commonExecOpts })

    const gitStatus = await exec.getExecOutput(
        'git status -s package*.json',
        [],
        {
            ...commonExecOpts,
        }
    );

    if (gitStatus.stdout.length > 0) {
        logger.debug('There are updated available')
        logger.debug('Setting up git')
        
        setUpGit()
        logger.debug('Comminting and Pushing the package*.json files')
        await exec.exec(`git checkout -b ${targeBranch}`, [], { ...commonExecOpts })
        await exec.exec(`git add package.json package-lock.json`, [], { ...commonExecOpts })
        await exec.exec(`git commit -m "chore: update dependencies"`, [], { ...commonExecOpts })
        await exec.exec(`git push -u origin ${targeBranch} --force`, [], { ...commonExecOpts })
       
        logger.debug('fetching octokit instance and creating pull request')
        const octKit = github.getOctokit(githubToken)

        try {
            logger.debug(`Creating pull request using headBranch ${{ headBranch }}`)
            await octKit.pulls.create({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                base: headBranch,
                head: targeBranch,
                title: 'chore: update npm dependencies',
                body: 'chore: this pull update npm dependencies package*.json files',
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