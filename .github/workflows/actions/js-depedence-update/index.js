const core = require('@actions/core');
const { exec } = require('@actions/exec');
const github = require('@actions/github');

const validateBranchName = ({ branchName }) => (/^[a-zA-Z0-9_\-\.\/]+$/.test(branchName))
const validateDir = ({ dirName }) => (/^[a-zA-Z0-9_\-\/]+$/.test(dirName))


async function run() {
    const baseBranch = core.getInput('base-branch', { required: true })
    const targeBranch = core.getInput('target-branch', { required: true })
    const githubToken = core.getInput('gh-token', { required: true })
    const workingDir = core.getInput('working-directory', { required: true })
    const debug = core.getBooleanInput('debug')


    const commonExecOpts = {
        cwd: workingDir
    }

    core.setSecret(githubToken)

    if (!validateBranchName({ branchName: baseBranch })) {
        core.setFailed('Invalid base branch name. branch name should include only alphabets, numbers, _, -, ., /')
        return
    }

    if (!validateBranchName({ branchName: targeBranch })) {
        core.setFailed('Invalid target name. branch name should include only alphabets, numbers, _, -, ., /')
        return
    }

    if (!validateDir({ dirNAme: workingDir })) {
        core.setFailed('Invalid working directory. Directory name should include only alphabets, numbers, _, -')
        return
    }

    core.info(`Base Branch: ${baseBranch}`)
    core.info(`Target Branch: ${targeBranch}`)
    core.info(`working directory: ${workingDir}`)

    await exec('npm update', [], { ...commonExecOpts })

    const gitStatus = await exec.getExecOutput(
        'git status -s package*.json',
        [],
        {
            ...commonExecOpts,
        }
    );

    if (gitStatus.stdout.length > 0) {
        core.info('Changes detected in package*.json files')
        await exec.exec('git config --global user.email "gh-automation@email.com"')
        await exec.exec('git config --global user.name "gh-automation"')

        await exec.exec(`git checkout -b ${targeBranch}`, [], { ...commonExecOpts })
        await exec.exec(`git add package.json package-lock.json`, [], { ...commonExecOpts })
        await exec.exec(`git commit -m "chore: update dependencies"`, [], { ...commonExecOpts })
        await exec.exec(`git push -u origin ${targeBranch} --force`, [], { ...commonExecOpts })

        const octKit = github.getOctokit(githubToken)

        try {
            await octKit.pulls.create({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                base: baseBranch,
                head: targeBranch,
                title: 'chore: update npm dependencies',
                body: 'chore: this pull update npm dependencies package*.json files',
            })
        } catch (error) {
            core.error('Error while creating pull request')
            core.setFailed(error.message)
            core.error(error)
            return
        }

    } else {
        core.info('No changes detected in package*.json files')
    }

    core.info('I am custom JS Action')
}

run()