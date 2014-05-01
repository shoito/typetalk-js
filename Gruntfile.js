module.exports = function(grunt) {
    'use strict';
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        fileName: 'typetalk',
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            dist: {
                src: ['typetalk.min.js']
            },
        },

        jshint: {
            files: ['gruntfile.js', 'typetalk.js', 'test/**/*.js'],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        uglify: {
            options: {
                banner: '/*! typetalk-js <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            dist: {
                src: '<%= fileName %>.js',
                dest: '<%= fileName %>.min.js'
            }
        },

        watch: {
            files: ['<%= jshint.files %>'],
            tasks: ['jshint']
        }
    });

    grunt.registerTask('default', ['clean', 'jshint', 'uglify']);
};