module.exports = function (grunt) {
  grunt.initConfig({
    execute: {
      target: {
        src: ['tests/*.js']
      }
    },
  });

  grunt.loadNpmTasks('grunt-execute');
  grunt.registerTask('test', ['execute']);
  grunt.registerTask('default', ['test']);
};