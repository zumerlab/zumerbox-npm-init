#!/usr/bin/env node
import validate from 'validate-npm-package-name'
import { exec } from 'child_process'
import fetch from 'node-fetch'
import readlineSync from 'readline-sync'
import chalk from 'chalk'
import fs from 'fs'

export async function validateAndInitNPM() {
  // Get default author name from git
  const defaultAuthor = await getDefaultAuthorName()

  // Prompt for package name
  const packageName = readlineSync.question('Enter the package name: ')

  // Prompt for publishing on npm
  const publishOnNpm = readlineSync.question(
    'Do you want to publish this package on npm? (default: y)',
    { defaultInput: 'y' }
  )

  // Prompt for proxy with default value as "no"
  const useProxy = readlineSync.question(
    'Are you behind a proxy? (default: n)',
    { defaultInput: 'n' }
  )

  // If behind proxy, prompt for proxy URL
  let proxyURL = ''
  if (useProxy !== 'n') {
    proxyURL = readlineSync.question('Enter the proxy URL: ')
  }

  // Initialize package with default author name and MIT license
  if (publishOnNpm !== 'y') {
    console.log(
      chalk.yellow('Publishing on npm skipped. Initializing package...')
    )
    await initializePackage(packageName, defaultAuthor, 'MIT')
    return
  }

  await validateAndInitNpmWithPublish(packageName, proxyURL, defaultAuthor)
}

async function getDefaultAuthorName() {
  return new Promise((resolve, reject) => {
    exec('git config user.name', (error, stdout, stderr) => {
      if (error) {
        console.error(
          chalk.red(`Error getting default author name: ${error.message}`)
        )
        reject(error)
        return
      }
      if (stderr) {
        console.error(chalk.red(`Error getting default author name: ${stderr}`))
        reject(new Error(stderr))
        return
      }
      resolve(stdout.trim())
    })
  })
}

async function createOrUpdatePackageJson(packageName, author) {
  // Check if package.json file exists
  const packageJsonPath = './package.json'
  const packageJsonExists = fs.existsSync(packageJsonPath)

  // If package.json file exists, read its content
  let packageJson = {}
  if (packageJsonExists) {
    try {
      const packageJsonData = fs.readFileSync(packageJsonPath, 'utf8')
      packageJson = JSON.parse(packageJsonData)
      // Update or add properties in the packageJson object
      packageJson.name = packageName
      packageJson.author = author
      packageJson.license = 'MIT'
    } catch (error) {
      console.error(chalk.red('Error reading package.json file:'), error)
      return
    }
  } else {
    // If package.json file doesn't exist, create a basic structure
    packageJson = {
      name: packageName,
      version: '1.0.0',
      description: '',
      main: 'index.js',
      scripts: {
        test: 'echo "Error: no test specified" && exit 1'
      },
      author: author,
      license: 'MIT'
    }
  }

  // Update or create the package.json file
  try {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
    console.log(
      packageJsonExists ?
        'package.json updated successfully!'
      : 'package.json created successfully!'
    )
  } catch (error) {
    console.error(
      chalk.red('An error occurred while updating or creating package.json:'),
      error
    )
  }
}

async function initializePackage(packageName, author, license) {
  console.log(
    chalk.green(`Initializing npm package with name "${packageName}"...`)
  )
  await createOrUpdatePackageJson(packageName, author)
}

async function validateAndInitNpmWithPublish(packageName, proxyURL, author) {
  const validationResult = validate(packageName)
  const errors = [
    ...(validationResult.errors || []),
    ...(validationResult.warnings || [])
  ]
  if (errors.length > 0) {
    console.error(chalk.red('Invalid package name:'))
    errors.forEach((error) => console.error(chalk.red(`- ${error}`)))
    return
  }

  let url
  if (proxyURL) {
    const proxy = new HttpsProxyAgent(proxyURL)
    url = await fetch(`https://registry.npmjs.com/${packageName}`, {
      agent: proxy
    })
  } else {
    url = await fetch(`https://registry.npmjs.com/${packageName}`)
  }

  try {
    const response = await url.json()
    if (response.error) {
      console.log(
        chalk.green(`Package name "${packageName}" is available on npm.`)
      )

      // Initialize npm package with --scope and --access flags for publishing
      console.log(
        chalk.green(
          `Initializing npm package with name "${packageName}" for publishing...`
        )
      )
      await createOrUpdatePackageJson(packageName, author)
      console.log(chalk.green('Npm package initialized successfully!'))
    } else {
      console.error(
        chalk.red(`Package name "${packageName}" is not available on npm.`)
      )
      // Prompt for package name
      const altPackageName = readlineSync.question('Try another package name: ')
      await validateAndInitNpmWithPublish(altPackageName, proxyURL, author)
    }
  } catch (error) {
    console.error(
      chalk.red('An error occurred while checking package availability on npm.')
    )
    console.error(error)
  }
}

function execAsync(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      if (stderr) {
        reject(new Error(stderr))
        return
      }
      resolve(stdout)
    })
  })
}

validateAndInitNPM()
