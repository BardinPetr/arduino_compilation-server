var arduinopathC = "C:\\Users\\Petr\\Downloads\\arduino-1.6.8-windows\\arduino-1.6.8\\arduino_debug.exe";
var arduinopath = arduinopathC;

var http = require('http'),
    fileSystem = require('fs'),
    path = require('path'),
    shell = require('shelljs');

var port = 2000;

process.argv.forEach(function(val, index, array) {
    if (val == '-p') {
        port = parseInt(array[index + 1], 10);
    } else if (val == '-a') {
        arduinopathC = array[index + 1];
    }

    if (array.length === index + 1) {
        start();
    }
});

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

function start() {
    http.createServer(function(request, response) {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST');
        response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
        response.setHeader('Access-Control-Allow-Credentials', true);
        var board, sketch;
        var ok = true;

        if (request.method == 'POST') {
            var body = [];
            request.on('data', function(chunk) {
                body.push(chunk);
            }).on('end', function() {
                try {
                    body = JSON.parse(Buffer.concat(body).toString());
                    board = body.board;
                    sketch = body.sketch;
                } catch (Exception) {
                    response.writeHead(400);
                    response.end();
                    ok = false;
                }
            });
        } else {
            var data = request.url
            if (data == '/favicon.ico') {
                response.writeHead(200);
            } else {
                try {
                    data = decodeURI(data);
                    data = data.substring(7);
                    var json = JSON.parse(data);
                    board = json.board;
                    sketch = json.sketch;
                    sketch = sketch.replace(/%0A/g, '\n');
                } catch (Exception) {
                    response.writeHead(400);
                    response.end();
                    ok = false;
                }
            }
        }

        if (ok) {
            arduinopath = arduinopathC;
            var rnd = "s" + randomInt(0, 99999).toString();
            var rnd_o = "o" + rnd;
            var s_Path = rnd + "/" + rnd + ".ino";
            var o_Path = rnd_o + "\\";
            var h_Path = rnd_o + "/" + rnd + ".ino.with_bootloader.hex";

            shell.exec("mkdir " + rnd, { silent: true });
            shell.exec("mkdir " + rnd_o, { silent: true });

            fileSystem.writeFile(s_Path, sketch, function(err) {
                if (err) {
                    response.writeHead(500);
                    response.end();
                    return console.log(err);
                }

                arduinopath += (" --board " + board) + (" --pref build.path=" + rnd_o) + (" --verify " + s_Path);
                shell.exec(arduinopath, function(code, stdout, stderr) {
                    if (code == 0) {
                        var filePath = path.join(__dirname, h_Path);

                        fileSystem.readFile(h_Path, 'utf8', function(err, data) {
                            if (err) {
                                response.writeHead(500);
                                response.end();
                                return log(err);
                            }

                            var output = { "code": code, "hex": data, "stderr": null, "stdout": stdout }
                            var _output = JSON.stringify(output);

                            response.writeHead(200, {
                                'Content-Type': 'application/json',
                                'Content-Length': _output.length
                            });
                            response.write(_output);
                            response.end();

                            shell.rm('-rf', rnd);
                            shell.rm('-rf', rnd_o);
                        });
                    } else {
                        stderr = stderr.replace(/Loading configuration.../g, '');
                        stderr = stderr.replace(/\r\nInitializing packages.../g, '');
                        stderr = stderr.replace(/\r\nPreparing boards.../g, '');
                        stderr = stderr.replace(/\r\nVerifying...\r\n/g, '');

                        var output = { "code": code, "hex": null, "stderr": stderr, "stdout": stdout }
                        var _output = JSON.stringify(output);

                        response.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Content-Length': _output.length
                        });
                        response.write(_output);
                        response.end();

                        shell.rm('-rf', rnd);
                        shell.rm('-rf', rnd_o);
                    }
                });
            });
        }
    }).listen(port);
}

function log(data) {
    console.log(data);
}