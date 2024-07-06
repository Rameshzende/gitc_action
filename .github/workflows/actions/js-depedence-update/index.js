const core = require('@actions/core');
const { exec } = require('@actions/exec');

const validateBranchName = ({ branchName }) => (/^[a-zA-Z0-9_\-\.\/]+$/.test(branchName))
const validateDir = ({ dirName }) => (/^[a-zA-Z0-9_\-\/]+$/.test(dirName))
       
async function run() {
    const baseBranch = core.getInput('base-branch')
    const targeBranch = core.getInput('target-branch')
    const githubToken = core.getInput('gh-token')
    const workingDir = core.getInput('working-directory')
    const debug = core.getBooleanInput('debug')

    core.setSecret(githubToken)

    if(!validateBranchName({ branchName: baseBranch })) {
        core.setFailed('Invalid base branch name. branch name should include only alphabets, numbers, _, -, ., /')
        return
    }

    if(!validateBranchName({ branchName: targeBranch })) {
        core.setFailed('Invalid target name. branch name should include only alphabets, numbers, _, -, ., /')
        return
    }

    if(!validateDir({ dirNAme: workingDir })) {
        core.setFailed('Invalid working directory. Directory name should include only alphabets, numbers, _, -')
        return
    }

    core.info(`Base Branch: ${baseBranch}`)
    core.info(`Target Branch: ${targeBranch}`)
    core.info(`working directory: ${workingDir}`)

    await exec('npm update', [], { cwd: workingDir })

    const gitStatus = await exec.getExecOutput('git status -s package*.json', [], { cwd: workingDir })

    if(gitStatus.stdout.length > 0) {
        core.info('Changes detected in package*.json files')
        core.info(gitStatus.stdout)
    } else {
        core.info('No changes detected in package*.json files')
    }
    
    /* 
      1. Parse Inputs: base-branch, from which check the updates
      2. Target branch to use to create PR the PR
      3. GEt GITHUB token
      4. Working directory

      5. npm update
    **/
   core.info('I am custom JS Action')
}

run()