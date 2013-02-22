/*
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
*/

/* What does this script do?
 *  - creates a cordova-wp7 directory in the specified path with updated tags according to whats in the VERSION file at the root.
 *  - clones and builds a new cordova.js for the windows platform
 *  - packages the .dll for the full template
 *  - injects both the full and standalone templates into the Visual Studio templates directory (if found).
 *
 * USAGE (command line)
 *  -> dist <path_to_new_build_dir>
 */

 /*TODO's
 - Find the path to the users visual studio template directory (currently assumes install directory for VS2012)
 - Load mobile-spec into test version for testing
 - For example project (and full?), get WP app files from standalone (to keep them updated)
        * Replace safeprojectname and guid with values
 - 
 */

/*************************************************/
/****************  REQUIREMENTS  *****************/
/*************************************************/
/*
Paths:
  - path to git.exe  -> C:\msysgit\bin
  - path to msbuild -> C:\Windows\Microsoft.NET\Framework\v4.0.30319
Famework
  - .NET 4.0
  - Windows phone SDKs


/************ Globals ********/

var fso = WScript.CreateObject('Scripting.FileSystemObject'),
    shell = WScript.CreateObject("shell.application"),
    wscript_shell = WScript.CreateObject("WScript.Shell");

//Replace root directory or create new directory?
var REPLACE = false;
//Get new version from git or build off this version?
var GET_NEW = false;
//Add templates to visual studio?
var ADD_TO_VS = true;

//Set up directory structure of current release
    //arguments passed in
var args = WScript.Arguments,
    //Root folder of cordova-wp7 (i.e C:\Cordova\cordova-wp7)
    ROOT = WScript.ScriptFullName.split('\\tooling\\', 1),
    //Sub folder containing templates
    TEMPLATES_PATH = '\\templates',
    //Sub folder for standalone project
    STANDALONE_PATH = TEMPLATES_PATH + '\\standalone',
    //Sub folder for full project
    FULL_PATH = TEMPLATES_PATH + '\\full'
    //Sub folder containing framework
    FRAMEWORK_PATH = '\\framework',
    //Subfolder containing example project
    EXAMPLE_PATH = '\\example',
    //Path to cordovalib folder, containing source for .dll
    CORDOVA_LIB = STANDALONE_PATH + '\\cordovalib',
    //Get version number
    VERSION=read(ROOT+'\\VERSION').replace(/\r\n/,'').replace(/\n/,'');
    BASE_VERSION = VERSION.split('rc', 1) + ".0";
    //Git Repositories
    CORDOVA_JS = "git://github.com/apache/cordova-js.git"

//Destination to build to
var BUILD_DESTINATION;


/*************************************************/
/****************  FUNCTIONS  ********************/
/*************************************************/


// help function
function Usage()
{
  WScript.Echo("");
  WScript.Echo("This is a command line tool for building new releases.")
  WScript.Echo("Usage: dist <NEW_PATH_FOR_BUILD>");
  WScript.Echo("Creates a new cordova/wp7 project with the version taken");
  WScript.Echo("from the VERSION file in the root directory");
  WScript.Echo("");
}

// generate unique project GUID - Not needed unless building an actual project (example?)
function genGuid()
{
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
              return v.toString(16);
            });
}

var ForReading = 1, ForWriting = 2, ForAppending = 8;
var TristateUseDefault = -2, TristateTrue = -1, TristateFalse = 0;

//Returns the contents of a file
function read(filename) {
    //WScript.Echo('Reading in ' + filename);
    var f=fso.OpenTextFile(filename, 1,2);
    var s=f.ReadAll();
    f.Close();
    return s;
}

//writes the contents to the specified file
function write(filename, contents) {
    var f=fso.OpenTextFile(filename, ForWriting, TristateTrue);
    f.Write(contents);
    f.Close();
}

//Replaces the matches of regexp with replacement
function replaceInFile(filename, regexp, replacement) {
    //WScript.Echo("Replaceing with "+replacement+ " in:");
    var text = read(filename).replace(regexp,replacement);
    //WScript.Echo(text);
    write(filename,text);
}

// exicutes a commmand in the shell
function exec(command) {
    var oShell=wscript_shell.Exec(command);
    while (oShell.Status == 0) {
        if(!oShell.StdOut.AtEndOfStream) {
            var line = oShell.StdOut.ReadLine();
            // XXX: Change to verbose mode
            // WScript.StdOut.WriteLine(line);
        }
        WScript.sleep(100);
    }
}

function cleanUp() {
  WScript.Echo("Cleanup...")
  if(fso.FolderExists(BUILD_DESTINATION + '\\temp'))
  {
      //exec('rd /s ' + BUILD_DESTINATION + '\\temp');
      fso.DeleteFolder(BUILD_DESTINATION + '\\temp', true);
  }
  if(fso.FileExists(BUILD_DESTINATION + FULL_PATH + '\\MyTemplate.vstemplate')) {
      fso.DeleteFile(BUILD_DESTINATION + FULL_PATH + '\\MyTemplate.vstemplate');
  }
  if(fso.FileExists(BUILD_DESTINATION + STANDALONE_PATH + '\\MyTemplate.vstemplate')) {
      fso.DeleteFile(BUILD_DESTINATION + STANDALONE_PATH + '\\MyTemplate.vstemplate');
  }

  //Add any other cleanup here

  WScript.Echo("DONE!");
}


/*************************************************/
/**************  MAIN SCRIPT  ********************/
/*************************************************/

if(REPLACE)
{
    BUILD_DESTINATION = ROOT;
}
else if(args.Count() > 0)
{
    BUILD_DESTINATION = args(0);
    //Support help flags
    if(BUILD_DESTINATION.indexOf("--help") > -1 ||
         BUILD_DESTINATION.indexOf("/?") > -1 )
    {
        Usage();
        WScript.Quit(1);
    }

}
else
{
    Usage();
    WScript.Quit(1);
}


//WScript.Echo("Root Folder : " + ROOT);
//WScript.Echo("CordovaLib Folder : " + CORDOVA_LIB);
//WScript.Echo("VERSION : " + VERSION);
//WScript.Echo("BASE_VERSION : " + BASE_VERSION);
//WScript.Echo("Generated GUID : " + newProjGuid);



/*************************************************/
/******************  Step 1  *********************/
/*************************************************/
/****** Copy source code to new directory ********/
/*************************************************/


if(!REPLACE)
{
    if(!GET_NEW) {

        if(fso.FolderExists(BUILD_DESTINATION))
        {
            WScript.Echo("Build directory already exists!");
            WScript.Quit(1);
        }

        //Set up file structure
        //exec('%comspec% /c mkdir ' + BUILD_DESTINATION);
        fso.CreateFolder(BUILD_DESTINATION);

        //Copy everything over to BUILD_DESTINATION
        var dest = shell.NameSpace(BUILD_DESTINATION);

        WScript.Echo("Copying files to build directory...");
        //Should we copy everything in the directory or just what we need? (ROOT may have other generated files in it)
        /** FOR EVERYTHING **
        var sourceItems = shell.NameSpace(ROOT).items();
        dest.CopyHere(sourceItems); */

        /** FOR JUST WHAT WE NEED - should copy by file instead? **/
        dest.CopyHere(ROOT + "\\bin");
        dest.CopyHere(ROOT + EXAMPLE_PATH);      //Should mostly be copied from standalone
        dest.CopyHere(ROOT + FRAMEWORK_PATH);
        dest.CopyHere(ROOT + TEMPLATES_PATH);
        dest.CopyHere(ROOT + "\\tests");
        dest.CopyHere(ROOT + "\\tooling");
        dest.CopyHere(ROOT + "\\.gitignore");
        dest.CopyHere(ROOT + "\\LICENSE");
        dest.CopyHere(ROOT + "\\NOTICE");
        dest.CopyHere(ROOT + "\\README.md");
        dest.CopyHere(ROOT + "\\VERSION");
    }
    else {
        var CORDOVA_WP7 = 'git://github.com/apache/cordova-wp7.git';
        //var CORDOVA_WP7 = 'https://github.com/bennmapes/cordova-wp7.git';

        wscript_shell.CurrentDirectory = BUILD_DESTINATION + '\\..';
        BUILD_DESTINATION = wscript_shell.CurrentDirectory + '\\cordova-wp7';

        WScript.Echo('Cloning cordova-wp7 from git, build destination now ' + BUILD_DESTINATION);
        exec('git clone ' + CORDOVA_WP7); //git fetch --tags && git checkout?
        //exec('git checkout CB-2403');

    } 
}


/*************************************************/
/******************  Step 2  *********************/
/*************************************************/
/*** Retag everything with new version numbers ***/
/*************************************************/
WScript.Echo("Updating version numbers....");
// Replace assembaly versions in framework
var framework_regex = /\(\"(\d+)[.](\d+)[.](\d+)(rc\d)?\"\)\]/g; //Will match ("x.x.x[rcx]")]
replaceInFile(BUILD_DESTINATION + FRAMEWORK_PATH + "\\Properties\\AssemblyInfo.cs", framework_regex, "(\"" + VERSION + "\")]");
framework_regex = /\(\"(\d+)[.](\d+)[.](\d+)[.](\d+)"\)\]/;
replaceInFile(BUILD_DESTINATION + FRAMEWORK_PATH + "\\Properties\\AssemblyInfo.cs", framework_regex, "(\"" + BASE_VERSION + "\")]");

// update standalone project
var cordova_regex = /cordova-(\d+)[.](\d+)[.](\d+)(rc\d)?/g; //Matches *first* cordova-x.x.x[rcx] (just ad g at end to make global)
replaceInFile(BUILD_DESTINATION + STANDALONE_PATH + '\\CordovaAppProj.csproj', cordova_regex,  "cordova-" + VERSION);
replaceInFile(BUILD_DESTINATION + STANDALONE_PATH + '\\CordovaSourceDictionary.xml', cordova_regex,  "cordova-" + VERSION);
replaceInFile(BUILD_DESTINATION + STANDALONE_PATH + '\\www\\index.html', cordova_regex,  "cordova-" + VERSION);
var version_regex = /return\s*\"(\d+)[.](\d+)[.](\d+)(rc\d)?/; //Matches return "x.x.x[rcx]
replaceInFile(BUILD_DESTINATION + CORDOVA_LIB + '\\Commands\\Device.cs', version_regex,  "return \"" + VERSION);

//Update full project
dest = shell.NameSpace(BUILD_DESTINATION + FULL_PATH);
dest.CopyHere(BUILD_DESTINATION + "\\VERSION", 20);
replaceInFile(BUILD_DESTINATION + FULL_PATH + '\\CordovaAppProj.csproj', cordova_regex,  "cordova-" + VERSION);
replaceInFile(BUILD_DESTINATION + FULL_PATH + '\\CordovaSourceDictionary.xml', cordova_regex,  "cordova-" + VERSION);
replaceInFile(BUILD_DESTINATION + FULL_PATH + '\\www\\index.html', cordova_regex,  "cordova-" + VERSION);
version_regex = /\"WPCordovaClassLib\,\s*Version\=(\d+)[.](\d+)[.](\d+)[.](\d+)/; //Matches "WPCordovaClassLib, Version=x.x.x.x
replaceInFile(BUILD_DESTINATION + FULL_PATH + '\\CordovaAppProj.csproj', version_regex,  "\"WPCordovaClassLib, Version=" + BASE_VERSION);

//Update example proj
replaceInFile(BUILD_DESTINATION + EXAMPLE_PATH + '\\CordovaExample.csproj', cordova_regex,  "cordova-" + VERSION);
replaceInFile(BUILD_DESTINATION + EXAMPLE_PATH + '\\CordovaSourceDictionary.xml', cordova_regex,  "cordova-" + VERSION);
version_regex = /VERSION\s*\=\s*\'(\d+)[.](\d+)[.](\d+)(rc\d)?/;  //Matches VERSION = x.x.x[rcx]
replaceInFile(BUILD_DESTINATION + EXAMPLE_PATH + '\\www\\cordova-current.js', version_regex,  "VERSION = \'" + VERSION);

//Update template discription
version_regex = /version\:\s*(\d+)[.](\d+)[.](\d+)(rc\d)?/; //Matches version: x.x.x[rcx]
replaceInFile(BUILD_DESTINATION + TEMPLATES_PATH + '\\description.txt', version_regex,  "version: " + VERSION);

//update .vstemplate files for the template zips.
var name_regex = /CordovaWP7[_](\d+)[_](\d+)[_](\d+)(rc\d)?/g
var discript_regex = /Cordova\s*(\d+)[.](\d+)[.](\d+)(rc\d)?/
replaceInFile(BUILD_DESTINATION + TEMPLATES_PATH + '\\vs\\MyTemplateFull.vstemplate', name_regex,  'CordovaWP7_' + VERSION.replace(/\./g, '_'));
replaceInFile(BUILD_DESTINATION + TEMPLATES_PATH + '\\vs\\MyTemplateFull.vstemplate', discript_regex,  "Cordova " + VERSION);
replaceInFile(BUILD_DESTINATION + TEMPLATES_PATH + '\\vs\\MyTemplateFull.vstemplate', cordova_regex,  "cordova-" + VERSION);

replaceInFile(BUILD_DESTINATION + TEMPLATES_PATH + '\\vs\\MyTemplateStandAlone.vstemplate', name_regex,  'CordovaWP7_' + VERSION.replace(/\./g, '_'));
replaceInFile(BUILD_DESTINATION + TEMPLATES_PATH + '\\vs\\MyTemplateStandAlone.vstemplate', discript_regex,  "Cordova " + VERSION);
replaceInFile(BUILD_DESTINATION + TEMPLATES_PATH + '\\vs\\MyTemplateStandAlone.vstemplate', cordova_regex,  "cordova-" + VERSION);

/*************************************************/
/******************  Step 3  *********************/
/*************************************************/
/*** Download and build cordova.js for windows ***/
/*************************************************/

WScript.Echo("Creating cordova.js...");
if(fso.FolderExists(BUILD_DESTINATION + '\\temp'))
{
    fso.DeleteFolder(BUILD_DESTINATION + '\\temp', true);
}
//exec('mkdir ' + BUILD_DESTINATION + '\\temp');
fso.CreateFolder(BUILD_DESTINATION + '\\temp');
wscript_shell.CurrentDirectory = BUILD_DESTINATION + '\\temp';

WScript.Echo('\tCloning js tagged with ' + VERSION + '...');
//Grab the js taged with the specified VERSION
exec('%comspec% /c git clone ' + CORDOVA_JS + ' && cd cordova-js && git fetch --tags && git checkout ' + VERSION );
//WScript.sleep(5000);
// build and copy over cordova.js
WScript.Echo("\tBuilding Cordova.js...");
wscript_shell.CurrentDirectory = BUILD_DESTINATION + '\\temp\\cordova-js';
exec('%comspec% /c jake build');
wscript_shell.CurrentDirectory = BUILD_DESTINATION + '\\temp\\cordova-js\\pkg';
exec('%comspec% /c copy cordova.windowsphone.js ' + BUILD_DESTINATION + STANDALONE_PATH + '\\www\\cordova-' + VERSION + '.js');
exec('%comspec% /c copy cordova.windowsphone.js ' + BUILD_DESTINATION + FULL_PATH + '\\www\\cordova-' + VERSION + '.js');
exec('%comspec% /c copy cordova.windowsphone.js ' + BUILD_DESTINATION + EXAMPLE_PATH + '\\www\\cordova-' + VERSION + '.js');


/*************************************************/
/******************  Step 4  *********************/
/*************************************************/
/** Package framework & core plugins into .dll  **/
/*************************************************/

WScript.Echo("Packaging .dll ...");
//move to framework directory
wscript_shell.CurrentDirectory = BUILD_DESTINATION + FRAMEWORK_PATH;
//Build .dll in Release
exec('msbuild /p:Configuration=Release;VersionNumber=' + VERSION + ';BaseVersionNumber=' + BASE_VERSION);
if(!fso.FolderExists(BUILD_DESTINATION + FULL_PATH + '\\CordovaLib'))
{
    fso.CreateFolder(BUILD_DESTINATION + FULL_PATH + '\\CordovaLib');
}
exec('%comspec% /c copy Bin\\Release\\WPCordovaClassLib.dll ' + BUILD_DESTINATION + FULL_PATH + '\\CordovaLib');


/*************************************************/
/******************  Step 5  *********************/
/*************************************************/
/** Zip templates and inject into Visual Studio **/
/*************************************************/

WScript.Echo("Creating template .zip files ...");

var standalone_zip = BUILD_DESTINATION + '\\CordovaWP7_' + VERSION.replace(/\./g, '_') + '_StandAlone.zip';
var full_zip = BUILD_DESTINATION + '\\CordovaWP7_' + VERSION.replace(/\./g, '_') + '_Full.zip';
if(fso.FileExists(standalone_zip))
{
  fso.DeleteFile(standalone_zip);
}
if(fso.FileExists(full_zip))
{
  fso.DeleteFile(full_zip);
}

exec('%comspec% /c copy ' + BUILD_DESTINATION + TEMPLATES_PATH + '\\vs\\MyTemplateFull.vstemplate ' + BUILD_DESTINATION + FULL_PATH + '\\MyTemplate.vstemplate');
exec('%comspec% /c copy ' + BUILD_DESTINATION + '\\VERSION ' + BUILD_DESTINATION + FULL_PATH);
exec('%comspec% /c copy Bin\\Release\\WPCordovaClassLib.dll ' + BUILD_DESTINATION + FULL_PATH + '\\CordovaLib');

exec('%comspec% /c copy ' + BUILD_DESTINATION + TEMPLATES_PATH + '\\vs\\MyTemplateStandAlone.vstemplate ' + BUILD_DESTINATION + STANDALONE_PATH + '\\MyTemplate.vstemplate');
exec('%comspec% /c copy ' + BUILD_DESTINATION + '\\VERSION ' + BUILD_DESTINATION + STANDALONE_PATH);

exec('cscript ' + BUILD_DESTINATION + '\\tooling\\scripts\\win-zip.js ' + full_zip + ' ' + BUILD_DESTINATION + FULL_PATH + '\\');
exec('cscript ' + BUILD_DESTINATION + '\\tooling\\scripts\\win-zip.js ' + standalone_zip + ' ' + BUILD_DESTINATION + STANDALONE_PATH + '\\');


if(ADD_TO_VS)
{
    var template_dir = wscript_shell.ExpandEnvironmentStrings("%USERPROFILE%") + '\\Documents\\Visual Studio 2012\\Templates\\ProjectTemplates';
    if(fso.FolderExists(template_dir ))
    {
        dest = shell.NameSpace(template_dir);
        dest.CopyHere(standalone_zip, 20);
        dest.CopyHere(full_zip, 20);
    }
    else
    {
        WScript.Echo("Could not find template directory in Visual Studio,\n you can manually copy over the template .zip files.")
    }
}

cleanUp();