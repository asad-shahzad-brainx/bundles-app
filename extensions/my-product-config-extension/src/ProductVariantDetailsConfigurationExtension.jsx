import {
  reactExtension,
  useApi,
  Text,
} from '@shopify/ui-extensions-react/admin';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)

export default reactExtension('admin.product-variant-details.configuration.render', () => <App />);

function App() {
  
  const {extension: {target}, i18n} = useApi();
  
  return (
    <Text>
      {i18n.translate('welcome', {target})}
    </Text>
  );
}