import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import headlessBackupTask from './src/services/headlessBackupTask';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask('BackupHeadlessTask', () => headlessBackupTask);
