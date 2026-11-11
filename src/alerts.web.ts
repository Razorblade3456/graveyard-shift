import type { AlertButton } from 'react-native';
// React Native Web's Alert.alert is a no-op. Retain confirmations and error messages.
export const Alert={alert(title:string,message?:string,buttons?:AlertButton[]){
 const text=[title,message].filter(Boolean).join('\n\n');
 if(!buttons?.length){window.alert(text);return;}
 const action=buttons.find(b=>b.style!=='cancel'&&b.text!=='Cancel'),cancel=buttons.find(b=>b.style==='cancel'||b.text==='Cancel');
 if(window.confirm(`${text}\n\n${action?.text??'Continue'}?`))action?.onPress?.();else cancel?.onPress?.();
}};
