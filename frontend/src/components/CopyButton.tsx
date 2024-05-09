// example from https://mantine.dev/core/copy-button/
import { CopyButton as CopyButtonMantine, ActionIcon, Tooltip, rem } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

export default function CopyButton({value} : {value: string}) {
  return (
    <CopyButtonMantine value={value} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="right">
          <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
            {copied ? (
              <IconCheck style={{ width: rem(20) }} />
            ) : (
              <IconCopy style={{ width: rem(20) }} />
            )}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButtonMantine>
  );
}