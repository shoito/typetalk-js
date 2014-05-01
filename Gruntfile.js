module.exports = function(grunt) {
    'use strict';
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        fileName: 'typetalk',
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            dist: {
                src: ['dist/**/*']
            },
        },

        jshint: {
            files: ['gruntfile.js', 'src/**/*.js', 'test/**/*.js'],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        copy: {
            dist: {
                cwd: 'src/',
                src: '**',
                dest: 'dist/',
                expand: true,
                flatten: true,
                filter: 'isFile'
            }
        },

        uglify: {
            options: {
                banner: '/*! typetalk-js <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            dist: {
                src: 'src/<%= fileName %>.js',
                dest: 'dist/<%= fileName %>.min.js'
            }
        },

        watch: {
            files: ['<%= jshint.files %>'],
            tasks: ['jshint']
        }
    });

    grunt.registerTask('default', ['clean', 'jshint', 'copy', 'uglify']);
};