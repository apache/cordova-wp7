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

var fso = WScript.CreateObject('Scripting.FileSystemObject'),
    shell = WScript.CreateObject("shell.application"),
    wscript_shell = WScript.CreateObject("WScript.Shell");

var args = WScript.Arguments,
    //Root folder of cordova-wp7 (i.e C:\Cordova\cordova-wp7)
    ROOT = WScript.ScriptFullName.split('\\tooling\\', 1),
    //Sub folder containing templates
    TEMPLATES_PATH = '\\templates',
    //Sub folder for standalone project
    STANDALONE_PATH = TEMPLATES_PATH + '\\standalone',
    //Sub folder for full project
    FULL_PATH = TEMPLATES_PATH + '\\full',
    //Sub folder containing framework
    FRAMEWORK_PATH = '\\framework',
    //Subfolder containing example project
    EXAMPLE_PATH = '\\example',
    //Git Repositories
    CORDOVA_JS = "git://github.com/apache/cordova-js.git",
    // get version
    VERSION = read(ROOT+'\\VERSION').replace(/\r\n/,'').replace(/\n/,''),
    BUILD_DESTINATION;


// help function
function Usage()
{
    WScript.StdOut.WriteLine("");
    WScript.StdOut.WriteLine("This Script builds the given virsion of cordova.js and injects it into this or the given cordova-wp7 ")
    WScript.StdOut.WriteLine("");
    WScript.StdOut.WriteLine("Usage: buildjs [ Version PathTOCordovaWP7 ]");
    WScript.StdOut.WriteLine("    Version : The version of cordova.js to build (must already be tagged)");
    WScript.StdOut.WriteLine("    PathTOCordovaWP7 : The path to the cordova directory where the new cordova.js will go.");
    WScript.StdOut.WriteLine("examples:");
    WScript.StdOut.WriteLine("    buildjs 2.5.0rc1  //Puts cordova-2.5.0rc1 as the cordova.js in the current working directory");
    WScript.StdOut.WriteLine("    buildjs 2.4.0 C:\\Users\\anonymous\\Desktop\\cordova-wp7  //Puts cordova-2.4.0.js in the given directory");
    WScript.StdOut.WriteLine("    buildjs //Builds the version of cordova.js from the root folder and adds it to the working directory repo");
    WScript.StdOut.WriteLine("");
}

// returns the contents of a file
function read(filename) {
    //WScript.StdOut.WriteLine('Reading in ' + filename);
    if(fso.FileExists(filename))
    {
        var f=fso.OpenTextFile(filename, 1,2);
        var s=f.ReadAll();
        f.Close();
        return s;
    }
    else
    {
        WScript.StdOut.WriteLine('Cannot read non-existant file : ' + filename);
        WScript.Quit(1);
    }
    return null;
}

// executes a commmand in the shell
function exec(command) {
    var oShell=wscript_shell.Exec(command);
    while (oShell.Status == 0) {
        WScript.sleep(100);
    }
}

// executes a commmand in the shell
function exec_verbose(command) {
    //WScript.StdOut.WriteLine("Command: " + command);
    var oShell=wscript_shell.Exec(command);
    while (oShell.Status == 0) {
        //Wait a little bit so we're not super looping
        WScript.sleep(100);
        //Print any stdout output from the script
        if(!oShell.StdOut.AtEndOfStream) {
            var line = oShell.StdOut.ReadLine();
            WScript.StdOut.WriteLine(line);
        }
    }
    //Check to make sure our scripts did not encounter an error
    if(!oShell.StdErr.AtEndOfStream)
    {
        var line = oShell.StdErr.ReadAll();
        WScript.StdErr.WriteLine(line);
        WScript.Quit(1);
    }
}

function build_js(path)
{
    if(fso.FolderExists(path + '\\temp'))
    {
        fso.DeleteFolder(path + '\\temp', true);
    }
    fso.CreateFolder(path + '\\temp');
    wscript_shell.CurrentDirectory = path + '\\temp';

    WScript.StdOut.WriteLine('\tCloning js tagged with ' + VERSION + '...');
    exec('%comspec% /c git clone ' + CORDOVA_JS + ' && cd cordova-js && git fetch && git checkout ' + VERSION );
    if(!fso.FolderExists(path + '\\temp\\cordova-js'))
    {
        WScript.StdErr.WriteLine("ERROR: Failed to clone cordova-js. Aborting...");
        WScript.Quit(1);
    }
    wscript_shell.CurrentDirectory = path + '\\temp\\cordova-js';
    WScript.StdOut.WriteLine("Building Cordova.js...");

    exec_verbose('%comspec% /c jake build');
    if(!fso.FolderExists(path + '\\temp\\cordova-js\\pkg'))
    {
        WScript.StdErr.WriteLine("ERROR: Failed to build cordova-js. Aborting...");
        WScript.Quit(1);
    }

    //copy the javascript wherever it needs to go.
    wscript_shell.CurrentDirectory = path + '\\temp\\cordova-js\\pkg';
    exec('%comspec% /c copy cordova.windowsphone.js ' + path + STANDALONE_PATH + '\\www\\cordova-' + VERSION + '.js');
    exec('%comspec% /c copy cordova.windowsphone.js ' + path + FULL_PATH + '\\www\\cordova-' + VERSION + '.js');
    exec('%comspec% /c copy cordova.windowsphone.js ' + path + EXAMPLE_PATH + '\\www\\cordova-' + VERSION + '.js');

    //TODO: Delete old cordova.js

    WScript.StdOut.WriteLine("SUCESS");
}

function set_path(some_arg)
{
    if(some_arg.indexOf('-p:')!= -1)
    {
        var path = some_arg.split('-p:')[1];
        if(fso.FolderExists(path) && fso.FolderExists(path + '\\tooling'))
        {
            BUILD_DESTINATION = path;
            return true;
        }
        else
        {
            WScript.StdOut.WriteLine("ERROR: The given path is not a cordova-wp7 repo, or");
            WScript.StdOut.WriteLine(" does not exist. If your trying to reversion a");
            WScript.StdOut.WriteLine(" cordova repo other then this one, please provide");
            WScript.StdOut.WriteLine(" it's path in the form: -p:C:\\Path\\to\\repo");
            WScript.Quit(1);
        }
        
    }
    return false;
}

WScript.StdOut.WriteLine("");

if(args.Count() > 1)
{
    set_path(args(1));
}

if(args.Count() > 0)
{
    //Support help flags
    if(args(0).indexOf("--help") > -1 ||
         args(0).indexOf("/?") > -1 )
    {
        Usage();
        WScript.Quit(1);
    }

    if(args(0).match(/(\d+)[.](\d+)[.](\d+)(rc\d)?/))
    {
        VERSION = args(0);
        if(args.Count()  == 1)
        {
            BUILD_DESTINATION = ROOT;
        }
    }
    else if(set_path(arg(0))) {} //do nothing
    else
    {
        WScript.StdOut.WriteLine("The provided version number is invalid, please provide");
        WScript.StdOut.WriteLine(" a version number in the format Major.Minor.Fix[rc#]")
        Usage();
        WScript.Quit(1);
    }
}
else
{
    BUILD_DESTINATION = ROOT;
}

//If we haven't quit by here, build the damn javascript!
WScript.StdOut.WriteLine("Creating js for " + BUILD_DESTINATION);
build_js(BUILD_DESTINATION);